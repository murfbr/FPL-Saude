import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { db, REGION } from '../config'
import * as admin from 'firebase-admin'
import {
  classifyAppointment,
  effectivePrice,
  BillingType,
} from '../shared/summaryCore'

const VALID_STATUSES = [
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]

interface CallerContext {
  uid: string
  role: string
  companyId: string
}

/** Resolve papel/empresa do chamador (claims com fallback no doc raiz). */
async function resolveCaller(
  auth: { uid: string; token: Record<string, unknown> } | undefined,
): Promise<CallerContext> {
  if (!auth?.uid) {
    throw new HttpsError(
      'unauthenticated',
      'Faça login para executar esta ação.',
    )
  }
  let role = auth.token.role as string | undefined
  let companyId = auth.token.companyId as string | undefined
  if (!role || !companyId) {
    const userSnap = await db.collection('users').doc(auth.uid).get()
    role = role || userSnap.data()?.role
    companyId = companyId || userSnap.data()?.companyId
  }
  if (!role || !companyId || role === 'client') {
    throw new HttpsError(
      'permission-denied',
      'Você não tem permissão para alterar agendamentos.',
    )
  }
  return { uid: auth.uid, role, companyId }
}

/** Profissional só altera o próprio agendamento, salvo feature update_all_statuses. */
async function assertCanChangeAppointment(
  caller: CallerContext,
  appt: admin.firestore.DocumentData,
): Promise<void> {
  if (caller.role === 'admin') return

  const profId = appt.professional_id as string | undefined
  if (profId) {
    if (profId === caller.uid) return
    const profSnap = await db
      .collection('companies')
      .doc(caller.companyId)
      .collection('professionals')
      .doc(profId)
      .get()
    if (profSnap.exists && profSnap.data()?.user_id === caller.uid) return
  }

  const companySnap = await db
    .collection('companies')
    .doc(caller.companyId)
    .get()
  const features: string[] =
    companySnap.data()?.roles?.[caller.role]?.features || []
  if (features.includes('update_all_statuses')) return

  throw new HttpsError(
    'permission-denied',
    'Você só pode atualizar o status dos seus próprios atendimentos.',
  )
}

/** Assinatura ativa do cliente para o serviço (mesma regra do client). */
async function hasActiveSubscription(
  companyId: string,
  clientId: string,
  serviceId: string,
): Promise<boolean> {
  const snap = await db
    .collection('companies')
    .doc(companyId)
    .collection('clients')
    .doc(clientId)
    .collection('subscriptions')
    .where('service_id', '==', serviceId)
    .get()
  return snap.docs.some((d) => {
    const s = d.data()
    return !s.status || s.status === 'active'
  })
}

/**
 * Muda o status de um agendamento com os efeitos financeiros em TRANSAÇÃO:
 * débito/estorno de sessão de pacote, criação/remoção do registro financeiro
 * (ID determinístico appt_<id> — corrida de dois cliques é inócua) e gravação
 * do billing_type que os agregados usam. Roda com Admin SDK: o client não
 * escreve mais financial_records ao concluir, e as rules podem exigir admin.
 */
export const setAppointmentStatus = onCall(
  { region: REGION },
  async (request) => {
    const { appointmentId, status, allowExhaustedPackageUse } = (request.data ||
      {}) as {
      appointmentId?: string
      status?: string
      allowExhaustedPackageUse?: boolean
    }

    if (!appointmentId || !status || !VALID_STATUSES.includes(status)) {
      throw new HttpsError(
        'invalid-argument',
        'appointmentId e status válido são obrigatórios.',
      )
    }

    const caller = await resolveCaller(request.auth)
    const companyRef = db.collection('companies').doc(caller.companyId)
    const apptRef = companyRef.collection('appointments').doc(appointmentId)
    const finCol = companyRef.collection('financial_records')

    const preSnap = await apptRef.get()
    if (!preSnap.exists) {
      throw new HttpsError('not-found', 'Agendamento não encontrado.')
    }
    const preData = preSnap.data() as admin.firestore.DocumentData
    await assertCanChangeAppointment(caller, preData)

    // Registros legados deste atendimento (IDs aleatórios de antes do ID
    // determinístico) — coletados fora da transação para poderem ser deletados
    const legacySnap = await finCol
      .where('appointment_id', '==', appointmentId)
      .get()
    const legacyRefs = legacySnap.docs.map((d) => d.ref)
    const deterministicFinRef = finCol.doc(`appt_${appointmentId}`)

    const isEvent = preData.entry_type === 'event'

    // Classificação fora da transação (leitura de subcoleção): a janela de
    // corrida aqui só afeta o rótulo billing_type, corrigido pelo cron
    let billing: BillingType = 'independent'
    if (!isEvent) {
      billing = classifyAppointment(preData)
      if (
        billing === 'independent' &&
        preData.client_id &&
        preData.service_id &&
        !preData.billing_type
      ) {
        if (
          await hasActiveSubscription(
            caller.companyId,
            preData.client_id,
            preData.service_id,
          )
        ) {
          billing = 'subscription'
        }
      }
    }

    let notifyMissingNote = false

    await db.runTransaction(async (tx) => {
      const apptSnap = await tx.get(apptRef)
      if (!apptSnap.exists) {
        throw new HttpsError('not-found', 'Agendamento não encontrado.')
      }
      const appt = apptSnap.data() as admin.firestore.DocumentData
      const oldStatus = appt.status as string
      if (oldStatus === status) return

      const amount = effectivePrice(appt)

      // ── Eventos flexíveis: só o registro financeiro ─────────────────────
      if (isEvent) {
        if (status === 'completed' && oldStatus !== 'completed') {
          if (amount > 0 && legacyRefs.length === 0) {
            tx.set(deterministicFinRef, {
              id: deterministicFinRef.id,
              client_id: null,
              professional_id: appt.professional_id || null,
              appointment_id: appointmentId,
              amount,
              payment_date: new Date().toISOString(),
              description: `Evento — ${appt.event_title || 'Sem título'}`,
              payment_method: 'manual',
              created_at: new Date().toISOString(),
              created_by: caller.uid,
            })
          }
        } else if (oldStatus === 'completed' && status !== 'completed') {
          for (const ref of legacyRefs) tx.delete(ref)
          tx.delete(deterministicFinRef)
        }
        tx.update(apptRef, { status })
        return
      }

      // ── Pacote: consumir/devolver sessão dentro da transação ────────────
      const isPackage = billing === 'package' && !!appt.client_package_id
      let packageSessionConsumed: boolean | undefined

      if (isPackage && appt.client_id) {
        const packageRef = companyRef
          .collection('clients')
          .doc(appt.client_id as string)
          .collection('packages')
          .doc(appt.client_package_id as string)

        const isConsuming = status === 'completed' || status === 'no_show'
        const wasConsuming =
          oldStatus === 'completed' || oldStatus === 'no_show'

        if (isConsuming && !wasConsuming) {
          const pkgSnap = await tx.get(packageRef)
          if (!pkgSnap.exists) {
            packageSessionConsumed = false
          } else {
            const pkg = pkgSnap.data() as admin.firestore.DocumentData
            const pkgUnavailable =
              pkg.status === 'cancelled' ||
              pkg.status === 'terminated' ||
              (pkg.sessions_remaining || 0) <= 0

            if (pkgUnavailable && !allowExhaustedPackageUse) {
              throw new HttpsError(
                'failed-precondition',
                'Pacote esgotado ou cancelado. Confirme a cortesia para concluir sem debitar sessão.',
                { code: 'PACKAGE_UNAVAILABLE' },
              )
            }
            if (pkgUnavailable) {
              packageSessionConsumed = false
            } else {
              tx.update(packageRef, {
                sessions_remaining: admin.firestore.FieldValue.increment(-1),
              })
              packageSessionConsumed = true
            }
          }
        } else if (wasConsuming && !isConsuming) {
          if (appt.package_session_consumed !== false) {
            tx.update(packageRef, {
              sessions_remaining: admin.firestore.FieldValue.increment(1),
            })
          }
        }
      }

      // ── Registro financeiro da sessão avulsa ────────────────────────────
      if (
        billing === 'independent' &&
        status === 'completed' &&
        oldStatus !== 'completed'
      ) {
        if (amount > 0 && legacyRefs.length === 0) {
          tx.set(deterministicFinRef, {
            id: deterministicFinRef.id,
            client_id: appt.client_id || null,
            professional_id: appt.professional_id || null,
            appointment_id: appointmentId,
            amount,
            payment_date: new Date().toISOString(),
            description: `Sessão Avulsa - ${appt.services?.name || 'Serviço'}`,
            payment_method: 'manual',
            created_at: new Date().toISOString(),
            created_by: caller.uid,
          })
        }
      } else if (oldStatus === 'completed' && status !== 'completed') {
        // Remove por existência, independente da classificação atual — ela pode
        // ter mudado desde a conclusão (ex.: assinatura cancelada depois)
        for (const ref of legacyRefs) tx.delete(ref)
        tx.delete(deterministicFinRef)
      }

      const apptUpdate: Record<string, unknown> = {
        status,
        billing_type: billing,
      }
      if (packageSessionConsumed !== undefined) {
        apptUpdate.package_session_consumed = packageSessionConsumed
      }
      tx.update(apptRef, apptUpdate)

      if (status === 'completed' && oldStatus !== 'completed') {
        const requiresObs = appt.services?.requires_observation
        const hasNotes = Array.isArray(appt.notes) && appt.notes.length > 0
        notifyMissingNote = !!requiresObs && !hasNotes
      }
    })

    // Notificação "Prontuário Pendente" — fora da transação (best-effort)
    if (notifyMissingNote && preData.professional_id) {
      try {
        const notifRef = companyRef
          .collection('professionals')
          .doc(preData.professional_id as string)
          .collection('notifications')
          .doc(`missing_note_${appointmentId}`)
        await notifRef.set({
          id: notifRef.id,
          professional_id: preData.professional_id,
          title: 'Prontuário Pendente',
          content: `O atendimento de ${preData.clients?.name || 'um cliente'} foi concluído. Por favor, adicione a evolução/observação.`,
          is_read: false,
          link: null,
          created_at: new Date().toISOString(),
        })
      } catch (e) {
        console.error('Falha ao criar notificação de prontuário pendente', e)
      }
    }

    return { ok: true }
  },
)

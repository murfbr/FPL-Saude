import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { db, REGION } from '../config'
import { monthKeyOf, summaryRef, appointmentDelta } from '../shared/helpers'

/**
 * Notificação "Aviso de Pacote" para os admins quando restarem 1–2 sessões.
 * Roda no servidor porque a lista de admins vive na coleção RAIZ `users`,
 * que o client não pode ler. ID determinístico do doc evita duplicatas em
 * redelivery do trigger.
 */
async function maybeNotifyPackageRunningLow(
  companyId: string,
  before: Record<string, any> | undefined,
  after: Record<string, any> | undefined,
) {
  if (!after?.client_package_id || !after?.client_id) return

  const consuming = ['completed', 'no_show']
  const isConsuming = consuming.includes(after.status)
  const wasConsuming = before ? consuming.includes(before.status) : false
  if (!isConsuming || wasConsuming) return
  // Cortesia não debita sessão — não gera aviso
  if (after.package_session_consumed === false) return

  // O trigger roda após o commit: sessions_remaining já está decrementado
  const pkgSnap = await db
    .collection('companies').doc(companyId)
    .collection('clients').doc(after.client_id)
    .collection('packages').doc(after.client_package_id)
    .get()
  if (!pkgSnap.exists) return

  const remaining = pkgSnap.data()?.sessions_remaining
  if (remaining !== 1 && remaining !== 2) return

  const adminsSnap = await db
    .collection('users')
    .where('companyId', '==', companyId)
    .where('role', '==', 'admin')
    .get()
  if (adminsSnap.empty) return

  const clientName = after.clients?.name || 'um cliente'
  const createdAt = new Date().toISOString()
  const notifId = `pkg_${after.client_package_id}_${remaining}`

  await Promise.all(
    adminsSnap.docs.map((adminDoc) =>
      db
        .collection('companies').doc(companyId)
        .collection('admins').doc(adminDoc.id)
        .collection('notifications').doc(notifId)
        .set({
          id: notifId,
          professional_id: adminDoc.id,
          title: 'Aviso de Pacote',
          content: `Faltam ${remaining} sessões para o pacote de ${clientName} acabar.`,
          is_read: false,
          link: `/admin/pacientes/${after.client_id}`,
          created_at: createdAt,
        }),
    ),
  )
}

export const onAppointmentWrite = onDocumentWritten(
  {
    document: 'companies/{companyId}/appointments/{appointmentId}',
    region: REGION,
  },
  async (event) => {
    const companyId = event.params.companyId
    const before = event.data?.before?.data()
    const after = event.data?.after?.data()

    try {
      await maybeNotifyPackageRunningLow(companyId, before, after)
    } catch (e) {
      console.error('Falha ao criar Aviso de Pacote', e)
    }

    const bMonth = before?.schedules?.start_time
      ? monthKeyOf(before.schedules.start_time as string)
      : null
    const aMonth = after?.schedules?.start_time
      ? monthKeyOf(after.schedules.start_time as string)
      : null

    if (!bMonth && !aMonth) return

    // Caso comum: mesmo mês (criação, atualização de status, etc.)
    if (bMonth === aMonth && aMonth) {
      const delta = appointmentDelta(before, after)
      if (delta) {
        delta.month = aMonth
        await summaryRef(companyId, aMonth).set(delta, { merge: true })
      }
      return
    }

    // Cross-month: reagendamento entre meses ou criação/deleção
    const writes: Promise<any>[] = []

    if (bMonth) {
      // Remover do mês antigo (trata como deleção naquele mês)
      const removal = appointmentDelta(before, undefined)
      if (removal) {
        removal.month = bMonth
        writes.push(
          summaryRef(companyId, bMonth).set(removal, { merge: true }),
        )
      }
    }

    if (aMonth) {
      // Adicionar no mês novo (trata como criação naquele mês)
      const addition = appointmentDelta(undefined, after)
      if (addition) {
        addition.month = aMonth
        writes.push(
          summaryRef(companyId, aMonth).set(addition, { merge: true }),
        )
      }
    }

    await Promise.all(writes)
  },
)

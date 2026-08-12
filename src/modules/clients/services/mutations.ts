import { db } from '@/shared/lib/firebase'
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  collectionGroup,
  orderBy,
  where,
  getCountFromServer,
  limit as fbLimit,
  writeBatch,
} from 'firebase/firestore'
import { Client, ClientPackageWithDetails, ClientSubscription, Appointment, NoteEntry, ClientExam } from '@/shared/types'
import { getCompanyId } from '@/shared/lib/tenantStore'

export async function createClient(
  clientData: Omit<Client, 'id' | 'created_at' | 'user_id' | 'is_active'>,
): Promise<{ data: Client | null; error: any }> {
  try {
    const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')
    const newDocRef = doc(clientsRef)

    // Parse birth date for indexing: "YYYY-MM-DD" -> "MM-DD"
    let birth_month_day = null
    if (clientData.birth_date) {
      const parts = clientData.birth_date.split('-')
      if (parts.length >= 3) {
        birth_month_day = `${parts[1]}-${parts[2]}`
      }
    }

    const newClient = {
      id: newDocRef.id,
      ...clientData,
      is_active: true,
      birth_month_day,
    }

    await setDoc(newDocRef, newClient)
    return { data: newClient as Client, error: null }
  } catch (error) {
    return { data: null, error }
  }
}


export async function updateClient(
  clientId: string,
  updates: Partial<Client>,
): Promise<{ data: Client | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'clients', clientId)

    // Auto-update birth_month_day if birth_date is changed
    if (updates.birth_date) {
      const parts = updates.birth_date.split('-')
      if (parts.length >= 3) {
        (updates as any).birth_month_day = `${parts[1]}-${parts[2]}`
      }
    }

    await updateDoc(docRef, updates)

    // Sincronizar dados denormalizados nos agendamentos
    if (updates.name !== undefined || updates.phone !== undefined || updates.email !== undefined) {
      const appointmentsRef = collection(db, 'companies', getCompanyId(), 'appointments')
      const q = query(appointmentsRef, where('client_id', '==', clientId))
      const apptsSnap = await getDocs(q)

      if (!apptsSnap.empty) {
        const batches = []
        let currentBatch = writeBatch(db)
        let operationCount = 0

        apptsSnap.forEach(apptDoc => {
          const apptData = apptDoc.data()
          const newClientsObj = {
            ...apptData.clients,
            ...(updates.name !== undefined && { name: updates.name }),
            ...(updates.phone !== undefined && { phone: updates.phone }),
            ...(updates.email !== undefined && { email: updates.email })
          }
          currentBatch.update(apptDoc.ref, { clients: newClientsObj })
          operationCount++

          if (operationCount === 500) {
            batches.push(currentBatch.commit())
            currentBatch = writeBatch(db)
            operationCount = 0
          }
        })

        if (operationCount > 0) {
          batches.push(currentBatch.commit())
        }
        await Promise.all(batches)
      }
    }

    const snapshot = await getDoc(docRef)
    return { data: { id: snapshot.id, ...snapshot.data() } as Client, error: null }
  } catch (error) {
    return { data: null, error }
  }
}


export interface ClientArchiveImpact {
  activeSubscriptions: number
  activePackages: number
  futureAppointments: number
}

const isActiveSubscription = (data: Record<string, unknown>) =>
  !data.status || data.status === 'active'

const isActivePackage = (data: Record<string, unknown>) =>
  data.status !== 'cancelled' &&
  data.status !== 'terminated' &&
  ((data.sessions_remaining as number) || 0) > 0

async function getFutureScheduledAppointments(clientId: string) {
  const companyId = getCompanyId()
  const nowISO = new Date().toISOString()
  const q = query(
    collection(db, 'companies', companyId, 'appointments'),
    where('client_id', '==', clientId),
  )
  const snap = await getDocs(q)
  return snap.docs.filter((d) => {
    const data = d.data()
    return data.status === 'scheduled' && (data.schedules?.start_time || '') >= nowISO
  })
}

/** Mostra ao admin o que o arquivamento vai afetar, ANTES de confirmar. */
export async function getClientArchiveImpact(
  clientId: string,
): Promise<{ data: ClientArchiveImpact | null; error: any }> {
  try {
    const companyId = getCompanyId()

    const [subsSnap, pkgsSnap, futureAppts] = await Promise.all([
      getDocs(collection(db, 'companies', companyId, 'clients', clientId, 'subscriptions')),
      getDocs(collection(db, 'companies', companyId, 'clients', clientId, 'packages')),
      getFutureScheduledAppointments(clientId),
    ])

    return {
      data: {
        activeSubscriptions: subsSnap.docs.filter((d) => isActiveSubscription(d.data())).length,
        activePackages: pkgsSnap.docs.filter((d) => isActivePackage(d.data())).length,
        futureAppointments: futureAppts.length,
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Arquiva o paciente com a cascata financeira: cancela assinaturas e pacotes
 * ativos (a previsão de receita para de contar com ele) e, se o admin escolher,
 * cancela os agendamentos futuros. Histórico (consultas, pagamentos, prontuário)
 * NÃO é tocado — guarda obrigatória (Lei 13.787/2018) e LGPD art. 16, I.
 */
export async function archiveClient(
  clientId: string,
  options: { cancelFutureAppointments: boolean },
): Promise<{ data: ClientArchiveImpact | null; error: any }> {
  try {
    const companyId = getCompanyId()
    const nowISO = new Date().toISOString()

    const [subsSnap, pkgsSnap, futureAppts] = await Promise.all([
      getDocs(collection(db, 'companies', companyId, 'clients', clientId, 'subscriptions')),
      getDocs(collection(db, 'companies', companyId, 'clients', clientId, 'packages')),
      getFutureScheduledAppointments(clientId),
    ])

    const batch = writeBatch(db)

    const activeSubs = subsSnap.docs.filter((d) => isActiveSubscription(d.data()))
    activeSubs.forEach((d) =>
      batch.update(d.ref, { status: 'cancelled', cancelled_at: nowISO, end_date: nowISO }),
    )

    const activePkgs = pkgsSnap.docs.filter((d) => isActivePackage(d.data()))
    activePkgs.forEach((d) => batch.update(d.ref, { status: 'cancelled', cancelled_at: nowISO }))

    if (options.cancelFutureAppointments) {
      // Só muda o status: o trigger de summaries entende a transição; agendamentos
      // 'scheduled' não têm registro financeiro nem sessão debitada para estornar
      futureAppts.forEach((d) => batch.update(d.ref, { status: 'cancelled' }))
    }

    batch.update(doc(db, 'companies', companyId, 'clients', clientId), { is_active: false })

    await batch.commit()

    return {
      data: {
        activeSubscriptions: activeSubs.length,
        activePackages: activePkgs.length,
        futureAppointments: options.cancelFutureAppointments ? futureAppts.length : 0,
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Exclusão real só para cadastro SEM histórico (criado por engano).
 * Com qualquer consulta, pagamento ou prontuário, a guarda é obrigatória
 * (Lei 13.787/2018 — 20 anos; documentos fiscais) — o caminho é Arquivar.
 */
export async function deleteClient(clientId: string): Promise<{ error: any }> {
  try {
    const companyId = getCompanyId()

    const hasAny = async (ref: ReturnType<typeof collection>) => {
      const snap = await getDocs(query(ref, fbLimit(1)))
      return !snap.empty
    }

    const clientRef = (sub: string) =>
      collection(db, 'companies', companyId, 'clients', clientId, sub)

    const apptsQ = query(
      collection(db, 'companies', companyId, 'appointments'),
      where('client_id', '==', clientId),
      fbLimit(1),
    )
    const finQ = query(
      collection(db, 'companies', companyId, 'financial_records'),
      where('client_id', '==', clientId),
      fbLimit(1),
    )

    const [hasAppts, hasFin, hasNotes, hasPkgs, hasSubs, hasExams, hasDocs] = await Promise.all([
      getDocs(apptsQ).then((s) => !s.empty),
      getDocs(finQ).then((s) => !s.empty),
      hasAny(clientRef('notes')),
      hasAny(clientRef('packages')),
      hasAny(clientRef('subscriptions')),
      hasAny(clientRef('exams')),
      hasAny(clientRef('clinical_documents')),
    ])

    if (hasAppts || hasFin || hasNotes || hasPkgs || hasSubs || hasExams || hasDocs) {
      return {
        error: new Error(
          'Este paciente possui histórico (consultas, pagamentos ou prontuário), que é de guarda obrigatória. Use "Arquivar" — o cadastro sai de uso, mas o histórico é preservado.',
        ),
      }
    }

    await deleteDoc(doc(db, 'companies', companyId, 'clients', clientId))
    return { error: null }
  } catch (error) {
    return { error }
  }
}

// Stubs for Payments, Memberships and Reports for now.
// O Supabase antigo tinha funções complexas para esses três que precisarão
// ser gradualmente construídas como subcoleções no Firestore.
// Subcoleções ativas para a UI

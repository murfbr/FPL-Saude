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
import { format } from 'date-fns'

export async function getClientsByProfessional(
  professionalId: string,
): Promise<{ data: Client[] | null; error: any }> {
  try {
    // No Firebase, procuramos os appointments do profissional
    const apptsRef = collection(db, 'companies', getCompanyId(), 'appointments')
    const qAppts = query(apptsRef, where('professional_id', '==', professionalId))
    const apptsSnap = await getDocs(qAppts)

    if (apptsSnap.empty) return { data: [], error: null }

    // Pega IDs únicos de clientes
    const clientIds = [...new Set(apptsSnap.docs.map(doc => doc.data().client_id))]
    if (clientIds.length === 0) return { data: [], error: null }

    // No Firestore, 'in' aceita array de até 30 itens. Para simplificar no momento, faremos chamadas em lote simples.
    // O ideal futuro seria desnormalizar uma subcoleção no próprio professional.
    const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')
    // Splitting into chunks of 10 for safe 'in' queries
    const chunks = []
    for (let i = 0; i < clientIds.length; i += 10) {
      chunks.push(clientIds.slice(i, i + 10))
    }

    const clients: Client[] = []
    for (const chunk of chunks) {
      const qClients = query(clientsRef, where('__name__', 'in', chunk))
      const snap = await getDocs(qClients)
      snap.forEach(doc => {
        const data = doc.data()
        if (data.is_active === true) {
          clients.push({ id: doc.id, ...data } as Client)
        }
      })
    }

    return { data: clients, error: null }
  } catch (error) {
    return { data: null, error }
  }
}


export async function getAllClients(filter?: {
  status?: 'all' | 'active' | 'inactive'
  serviceId?: string
}): Promise<{ data: Client[] | null; error: any }> {
  try {
    const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')
    let q = query(clientsRef, orderBy('name', 'asc'))

    if (filter?.status === 'active') {
      q = query(clientsRef, where('is_active', '==', true), orderBy('name', 'asc'))
    } else if (filter?.status === 'inactive') {
      q = query(clientsRef, where('is_active', '==', false), orderBy('name', 'asc'))
    }

    const snapshot = await getDocs(q)
    const clients: Client[] = []
    snapshot.forEach(doc => {
      clients.push({ id: doc.id, ...doc.data() } as Client)
    })

    return { data: clients, error: null }
  } catch (error) {
    console.error("🔥 [AÇÃO NECESSÁRIA - CLIQUE NO LINK ABAIXO PARA CRIAR ÍNDICE DE CLIENTES]: ", error)
    return { data: null, error }
  }
}


export async function getClientsCount(filter?: { status?: 'all' | 'active' | 'inactive' }): Promise<{ count: number; error: any }> {
  try {
    const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')
    let q = query(clientsRef)

    if (filter?.status === 'active') {
      q = query(clientsRef, where('is_active', '==', true))
    } else if (filter?.status === 'inactive') {
      q = query(clientsRef, where('is_active', '==', false))
    }

    const snapshot = await getCountFromServer(q)
    return { count: snapshot.data().count, error: null }
  } catch (error) {
    console.error("🔥 Erro ao puxar contador de clientes: ", error)
    return { count: 0, error }
  }
}


export async function getClientById(
  clientId: string,
): Promise<{ data: Client | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'clients', clientId)
    const snapshot = await getDoc(docRef)

    if (!snapshot.exists()) return { data: null, error: new Error('Cliente não encontrado') }
    return { data: { id: snapshot.id, ...snapshot.data() } as Client, error: null }
  } catch (error) {
    return { data: null, error }
  }
}


export async function getClientsWithBirthdayThisWeek(startDate: Date, endDate: Date): Promise<{ data: Client[] | null; error: any }> {
  try {
    const startStr = format(startDate, 'MM-dd')
    const endStr = format(endDate, 'MM-dd')
    const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')

    let results: Client[] = []

    if (startStr <= endStr) {
      // Normal week inside the same year
      const q = query(
        clientsRef,
        where('is_active', '==', true),
        where('birth_month_day', '>=', startStr),
        where('birth_month_day', '<=', endStr)
      )
      const snapshot = await getDocs(q)
      snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() } as Client))
    } else {
      // End of year crossing (e.g. 12-30 to 01-05) - requires two queries
      const q1 = query(
        clientsRef,
        where('is_active', '==', true),
        where('birth_month_day', '>=', startStr),
        where('birth_month_day', '<=', '12-31')
      )
      const q2 = query(
        clientsRef,
        where('is_active', '==', true),
        where('birth_month_day', '>=', '01-01'),
        where('birth_month_day', '<=', endStr)
      )
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)])
      snap1.forEach(doc => results.push({ id: doc.id, ...doc.data() } as Client))
      snap2.forEach(doc => results.push({ id: doc.id, ...doc.data() } as Client))
    }

    return { data: results, error: null }
  } catch (error) {
    console.error("Erro em getClientsWithBirthdayThisWeek:", error)
    return { data: null, error }
  }
}

// -------------------------------------------------------------------------------------------------
// CLIENT NOTES (PRONTUÁRIO / EVOLUÇÕES)
// -------------------------------------------------------------------------------------------------


import { db } from '@/lib/firebase'
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
} from 'firebase/firestore'
import { Client, ClientPackageWithDetails, ClientSubscription } from '@/types'
import { format, startOfMonth, endOfMonth } from 'date-fns'

const COMPANY_ID = 'fpl-saude'

export async function getClientsByProfessional(
  professionalId: string,
): Promise<{ data: Client[] | null; error: any }> {
  try {
    // No Firebase, procuramos os appointments do profissional
    const apptsRef = collection(db, 'companies', COMPANY_ID, 'appointments')
    const qAppts = query(apptsRef, where('professional_id', '==', professionalId))
    const apptsSnap = await getDocs(qAppts)
    
    if (apptsSnap.empty) return { data: [], error: null }
    
    // Pega IDs únicos de clientes
    const clientIds = [...new Set(apptsSnap.docs.map(doc => doc.data().client_id))]
    if (clientIds.length === 0) return { data: [], error: null }

    // No Firestore, 'in' aceita array de até 30 itens. Para simplificar no momento, faremos chamadas em lote simples.
    // O ideal futuro seria desnormalizar uma subcoleção no próprio professional.
    const clientsRef = collection(db, 'companies', COMPANY_ID, 'clients')
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
    const clientsRef = collection(db, 'companies', COMPANY_ID, 'clients')
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

export async function getClientById(
  clientId: string,
): Promise<{ data: Client | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'clients', clientId)
    const snapshot = await getDoc(docRef)
    
    if (!snapshot.exists()) return { data: null, error: new Error('Cliente não encontrado') }
    return { data: { id: snapshot.id, ...snapshot.data() } as Client, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function createClient(
  clientData: Omit<Client, 'id' | 'created_at' | 'user_id' | 'is_active'>,
): Promise<{ data: Client | null; error: any }> {
  try {
    const clientsRef = collection(db, 'companies', COMPANY_ID, 'clients')
    const newDocRef = doc(clientsRef)
    const newClient = { id: newDocRef.id, ...clientData, is_active: true }
    
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
    const docRef = doc(db, 'companies', COMPANY_ID, 'clients', clientId)
    await updateDoc(docRef, updates)
    
    const snapshot = await getDoc(docRef)
    return { data: { id: snapshot.id, ...snapshot.data() } as Client, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function deleteClient(clientId: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'clients', clientId)
    await deleteDoc(docRef)
    return { error: null }
  } catch (error) {
    return { error }
  }
}

// Stubs for Payments, Memberships and Reports for now.
// O Supabase antigo tinha funções complexas para esses três que precisarão
// ser gradualmente construídas como subcoleções no Firestore.
// Subcoleções ativas para a UI
export async function getClientPackages(clientId: string): Promise<{ data: any[] | null; error: any }> {
  try {
    const pkgsRef = collection(db, 'companies', COMPANY_ID, 'client_packages')
    const q = query(pkgsRef, where('client_id', '==', clientId))
    const snap = await getDocs(q)
    
    const results = []
    for(const d of snap.docs) {
      const data = d.data()
      const cp = { id: d.id, ...data } as any
      if (data.package_id) {
         const pSnap = await getDoc(doc(db, 'companies', COMPANY_ID, 'packages', data.package_id))
         if (pSnap.exists()) {
            const pkgData = pSnap.data()
            let sData = null
            if (pkgData.service_id) {
               const sSnap = await getDoc(doc(db, 'companies', COMPANY_ID, 'services', pkgData.service_id))
               if (sSnap.exists()) sData = { id: sSnap.id, ...sSnap.data() }
            }
            cp.packages = { ...pkgData, services: sData }
         }
      }
      results.push(cp)
    }
    return { data: results, error: null }
  } catch (error) { return { data: null, error } }
}

export async function getAllActiveClientPackages(): Promise<{ data: any[] | null; error: any }> {
  try {
    const pkgsRef = collection(db, 'companies', COMPANY_ID, 'client_packages')
    const q = query(pkgsRef, where('sessions_remaining', '>', 0))
    const snap = await getDocs(q)
    
    const results = []
    for(const d of snap.docs) {
       const data = d.data()
       const cp = { id: d.id, ...data } as any
       // Hidratação de Cliente
       if (data.client_id) {
          const cSnap = await getDoc(doc(db, 'companies', COMPANY_ID, 'clients', data.client_id))
          if (cSnap.exists()) cp.clients = { id: cSnap.id, ...cSnap.data() }
       }
       // Hidratação de Pacote
       if (data.package_id) {
          const pSnap = await getDoc(doc(db, 'companies', COMPANY_ID, 'packages', data.package_id))
          if (pSnap.exists()) cp.packages = { id: pSnap.id, ...pSnap.data() }
       }
       results.push(cp)
    }
    return { data: results, error: null }
  } catch (error) { return { data: null, error } }
}

export async function assignPackageToClient(clientId: string, packageId: string, sessions: number, purchaseDate?: Date): Promise<{ error: any }> {
  try {
    const pkgsRef = collection(db, 'companies', COMPANY_ID, 'client_packages')
    const newDoc = doc(pkgsRef)
    await setDoc(newDoc, {
        id: newDoc.id,
        client_id: clientId,
        package_id: packageId,
        sessions_remaining: sessions,
        purchase_date: purchaseDate ? purchaseDate.toISOString() : new Date().toISOString()
    })
    return { error: null }
  } catch(error) { return { error } }
}

export async function cancelClientPackage(clientPackageId: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'client_packages', clientPackageId)
    await deleteDoc(docRef)
    return { error: null }
  } catch(error) { return { error } }
}

export async function getClientSubscriptions(clientId: string): Promise<{ data: any[] | null; error: any }> {
  try {
    const subsRef = collection(db, 'companies', COMPANY_ID, 'client_subscriptions')
    const q = query(subsRef, where('client_id', '==', clientId))
    const snap = await getDocs(q)
    
    const results = []
    for(const d of snap.docs) {
      const data = d.data()
      const sub = { id: d.id, ...data } as any
      
      if (data.service_id) {
         const sSnap = await getDoc(doc(db, 'companies', COMPANY_ID, 'services', data.service_id))
         if (sSnap.exists()) sub.services = { id: sSnap.id, ...sSnap.data() }
      }
      if (data.subscription_plan_id) {
         const pSnap = await getDoc(doc(db, 'companies', COMPANY_ID, 'subscription_plans', data.subscription_plan_id))
         if (pSnap.exists()) sub.subscription_plans = { id: pSnap.id, ...pSnap.data() }
      }
      
      results.push(sub)
    }
    return { data: results, error: null }
  } catch (error) { return { data: null, error } }
}

export async function createClientSubscription(data: any): Promise<{ data: any | null; error: any }> {
  return { data: null, error: null }
}
export async function updateClientSubscription(subId: string, updates: any): Promise<{ error: any }> {
  return { error: null }
}
export async function cancelClientSubscription(subId: string): Promise<{ error: any }> {
  return { error: null }
}
export async function exportClientData(clientId: string, exportType: string, formatType: string): Promise<{ data: any | null; error: any }> {
  return { data: null, error: new Error('Not implemented for Firebase yet') }
}
export async function getClientsWithBirthdayThisWeek(startDate: Date, endDate: Date): Promise<{ data: Client[] | null; error: any }> {
  return { data: [], error: null } // RPC Not trivially convertible
}
export async function getMonthlyClientUsage(clientId: string, serviceId: string): Promise<{ count: number; error: any }> {
  return { count: 0, error: null }
}


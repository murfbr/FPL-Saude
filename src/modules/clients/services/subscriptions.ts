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

export async function getClientSubscriptions(clientId: string): Promise<{ data: any[] | null; error: any }> {
  try {
    const subsRef = collection(db, 'companies', getCompanyId(), 'clients', clientId, 'subscriptions')
    const snap = await getDocs(subsRef)

    const results = []
    for (const d of snap.docs) {
      const data = d.data()
      const sub = { id: d.id, ...data } as any

      if (data.service_id) {
        const sSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'services', data.service_id))
        if (sSnap.exists()) sub.services = { id: sSnap.id, ...sSnap.data() }
      }
      if (data.subscription_plan_id) {
        const pSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'subscription_plans', data.subscription_plan_id))
        if (pSnap.exists()) sub.subscription_plans = { id: pSnap.id, ...pSnap.data() }
      }

      results.push(sub)
    }
    return { data: results, error: null }
  } catch (error) {
    console.error("🔥 ERRO EM getClientSubscriptions (falta de índice?): ", error)
    return { data: null, error }
  }
}


export async function createClientSubscription(data: any): Promise<{ data: any | null; error: any }> {
  try {
    const subsRef = collection(db, 'companies', getCompanyId(), 'clients', data.client_id, 'subscriptions')

    // Trava de segurança: Verificar se já existe uma assinatura ativa para o mesmo serviço
    const q = query(
      subsRef, 
      where('service_id', '==', data.service_id),
      where('status', '==', 'active')
    )
    const existingDocs = await getDocs(q)
    
    if (!existingDocs.empty) {
      return { 
        data: null, 
        error: new Error('Este cliente já possui uma assinatura ativa para este serviço. Cancele a atual primeiro.') 
      }
    }

    const newDoc = doc(subsRef)
    const docData = { ...data, id: newDoc.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    await setDoc(newDoc, docData)
    return { data: docData, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function updateClientSubscription(subId: string, updates: any): Promise<{ error: any }> {
  return { error: null }
}

export async function cancelClientSubscription(clientId: string, subId: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'clients', clientId, 'subscriptions', subId)
    const nowISO = new Date().toISOString()
    await updateDoc(docRef, { status: 'cancelled', cancelled_at: nowISO, end_date: nowISO })
    return { error: null }
  } catch (error) { return { error } }
}


export async function getMonthlyClientUsage(clientId: string, serviceId: string): Promise<{ count: number; error: any }> {
  return { count: 0, error: null }
}


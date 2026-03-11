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
  collectionGroup,
  orderBy,
  where,
  limit as fbLimit
} from 'firebase/firestore'
import { ClientSubscription } from '@/types'
import { startOfMonth, endOfMonth, format } from 'date-fns'

const COMPANY_ID = 'fpl-saude'

export async function getInvoicedValue(startDate: string, endDate: string): Promise<{ data: number | null; error: any }> {
  try {
    const finRef = collection(db, 'companies', COMPANY_ID, 'financial_records')
    const q = query(finRef, where('payment_date', '>=', startDate), where('payment_date', '<=', endDate))
    const snap = await getDocs(q)
    
    let total = 0
    snap.forEach(doc => {
      total += (doc.data().amount || 0)
    })
    
    return { data: total, error: null }
  } catch (error) { return { data: null, error } }
}

export async function getExpectedRevenue(): Promise<{ data: number | null; error: any }> {
  try {
    const now = new Date().toISOString()
    const apptsRef = collection(db, 'companies', COMPANY_ID, 'appointments')
    const q = query(apptsRef, where('status', '==', 'scheduled'))
    
    const snap = await getDocs(q)
    let total = 0
    
    for (const d of snap.docs) {
      const appt = d.data()
      if (appt.schedules?.start_time >= now && appt.service_id) {
        const servSnap = await getDoc(doc(db, 'companies', COMPANY_ID, 'services', appt.service_id))
        total += (servSnap.data()?.price || 0)
      }
    }
    
    return { data: total, error: null }
  } catch (error) { return { data: null, error } }
}

export async function getActiveSubscriptions(): Promise<{ data: ClientSubscription[] | null; error: any }> {
  try {
    const subsRef = collectionGroup(db, 'subscriptions')
    const q = query(subsRef, where('status', '==', 'active'))
    const snap = await getDocs(q)
    
    const promises = snap.docs.map(async (docSnap) => {
      const sub = { id: docSnap.id, ...docSnap.data() } as any
      // Hydrating foreign relations for table
      if (sub.client_id) {
        const c = await getDoc(doc(db, 'companies', COMPANY_ID, 'clients', sub.client_id))
        sub.clients = { id: c.id, name: c.data()?.name, email: c.data()?.email }
      }
      if (sub.service_id) {
        const s = await getDoc(doc(db, 'companies', COMPANY_ID, 'services', sub.service_id))
        sub.services = { name: s.data()?.name, price: s.data()?.price }
      }
      if (sub.subscription_plan_id) {
         const p = await getDoc(doc(db, 'companies', COMPANY_ID, 'subscription_plans', sub.subscription_plan_id))
         sub.subscription_plans = { name: p.data()?.name, price: p.data()?.price }
      }
      return sub
    })
    
    const results = await Promise.all(promises)
    return { data: results as ClientSubscription[], error: null }
  } catch (error) {
    console.error("🔥 ERRO EM getActiveSubscriptions (possível falta de índice?): ", error)
    return { data: null, error }
  }
}

export async function getSubscriptionPayments(subscriptionIds: string[], monthDate: Date): Promise<{ data: any[] | null; error: any }> {
  if (!subscriptionIds || subscriptionIds.length === 0) return { data: [], error: null }
  
  try {
    const start = startOfMonth(monthDate).toISOString()
    const end = endOfMonth(monthDate).toISOString()

    const finRef = collection(db, 'companies', COMPANY_ID, 'financial_records')
    // Batch lookup chunks
    const chunks = []
    for (let i = 0; i < subscriptionIds.length; i += 10) { chunks.push(subscriptionIds.slice(i, i + 10)) }

    let results: any[] = []
    for (const chunk of chunks) {
      const q = query(finRef, where('client_subscription_id', 'in', chunk), where('payment_date', '>=', start), where('payment_date', '<=', end))
      const snap = await getDocs(q)
      snap.forEach(d => results.push({ id: d.id, ...d.data() }))
    }
    return { data: results, error: null }
  } catch (error) { return { data: null, error } }
}

export async function paySubscription(subscription: ClientSubscription, professionalId: string): Promise<{ error: any }> {
  try {
    const amount = subscription.subscription_plans?.price || subscription.services?.price || 0
    const description = `Mensalidade ${subscription.subscription_plans?.name || subscription.services?.name} - ${format(new Date(), 'MM/yyyy')}`

    const finRef = collection(db, 'companies', COMPANY_ID, 'financial_records')
    const newDoc = doc(finRef)
    await setDoc(newDoc, {
      id: newDoc.id,
      client_id: subscription.client_id,
      professional_id: professionalId,
      client_subscription_id: subscription.id,
      amount: amount,
      payment_date: new Date().toISOString(),
      description: description,
      payment_method: 'manual',
    })
    return { error: null }
  } catch (error) { return { error } }
}

export async function deleteSubscriptionPayment(recordId: string): Promise<{ error: any }> {
  try {
    await deleteDoc(doc(db, 'companies', COMPANY_ID, 'financial_records', recordId))
    return { error: null }
  } catch (error) { return { error } }
}

export async function getPackagePayments(clientPackageIds: string[]): Promise<{ data: any[] | null; error: any }> {
  if (!clientPackageIds || clientPackageIds.length === 0) return { data: [], error: null }
  
  try {
    const finRef = collection(db, 'companies', COMPANY_ID, 'financial_records')
    // Batch lookup chunks
    const chunks = []
    for (let i = 0; i < clientPackageIds.length; i += 10) { chunks.push(clientPackageIds.slice(i, i + 10)) }

    let results: any[] = []
    for (const chunk of chunks) {
      const q = query(finRef, where('client_package_id', 'in', chunk))
      const snap = await getDocs(q)
      snap.forEach(d => results.push({ id: d.id, ...d.data() }))
    }
    return { data: results, error: null }
  } catch (error) { return { data: null, error } }
}

export async function payPackage(clientPackage: any, professionalId: string): Promise<{ error: any }> {
  try {
    const amount = (clientPackage.packages?.price || 0) - (clientPackage.discount_amount || 0)
    const description = `Pacote ${clientPackage.packages?.name || ''}`

    const finRef = collection(db, 'companies', COMPANY_ID, 'financial_records')
    const newDoc = doc(finRef)
    await setDoc(newDoc, {
      id: newDoc.id,
      client_id: clientPackage.client_id,
      professional_id: professionalId,
      client_package_id: clientPackage.id,
      amount: amount,
      payment_date: new Date().toISOString(),
      description: description,
      payment_method: 'manual',
    })
    return { error: null }
  } catch (error) { return { error } }
}

export async function deletePackagePayment(recordId: string): Promise<{ error: any }> {
  try {
    await deleteDoc(doc(db, 'companies', COMPANY_ID, 'financial_records', recordId))
    return { error: null }
  } catch (error) { return { error } }
}

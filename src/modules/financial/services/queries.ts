import { db } from '@/shared/lib/firebase'
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
} from 'firebase/firestore'
import { ClientSubscription } from '@/shared/types'
import { startOfMonth, endOfMonth } from 'date-fns'

import { getCompanyId } from '@/shared/lib/tenantStore'

export async function getInvoicedValue(startDate: string, endDate: string): Promise<{ data: number | null; error: any }> {
  try {
    const finRef = collection(db, 'companies', getCompanyId(), 'financial_records')
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
    const apptsRef = collection(db, 'companies', getCompanyId(), 'appointments')
    const q = query(apptsRef, where('status', '==', 'scheduled'))
    
    const snap = await getDocs(q)
    let total = 0
    
    for (const d of snap.docs) {
      const appt = d.data()
      if (appt.schedules?.start_time >= now && appt.service_id) {
        const servSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'services', appt.service_id))
        total += (servSnap.data()?.price || 0)
      }
    }
    
    return { data: total, error: null }
  } catch (error) { return { data: null, error } }
}

export async function getActiveSubscriptions(options?: { limit?: number; targetDate?: Date }): Promise<{ data: ClientSubscription[] | null; error: any }> {
  try {
    // 1. Busca clientes para evitar o collectionGroup bloqueado nas regras de segurança
    const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')
    // Buscamos todos para garantir que clientes arquivados ainda apareçam nos meses passados
    const clientsSnap = await getDocs(query(clientsRef))
    
    let results: any[] = []
    
    // 2. Fetch subscriptions para cada cliente
    const promises = clientsSnap.docs.map(async (clientDoc) => {
      const subsRef = collection(db, 'companies', getCompanyId(), 'clients', clientDoc.id, 'subscriptions')
      
      let subsQuery = query(subsRef)
      if (!options?.targetDate) {
        subsQuery = query(subsRef, where('status', '==', 'active'))
      }
      const subsSnap = await getDocs(subsQuery)
      
      const hydratedSubs = []
      
      let mStartStr = ''
      let mEndStr = ''
      if (options?.targetDate) {
         mStartStr = startOfMonth(options.targetDate).toISOString()
         mEndStr = endOfMonth(options.targetDate).toISOString()
      }

      for (const docSnap of subsSnap.docs) {
        const sub = { id: docSnap.id, ...docSnap.data() } as any
        
        // Filtro de vigência da assinatura se targetDate estiver definido
        if (options?.targetDate) {
          const tStart = sub.start_date
          const tEnd = sub.end_date || sub.cancelled_at
          
          if (tStart && tStart > mEndStr) continue // Começou depois deste mês
          if (tEnd && tEnd < mStartStr) continue // Terminou antes deste mês
          
          // Tratamento de segurança: se o status não for 'active' e ela não tiver data de fim preenchida,
          // consideramos dado sujo/antigo e ignoramos para não assombrar como ativa infinitamente.
          if (!tEnd && sub.status && sub.status !== 'active') {
             continue
          }
        }

        sub.clients = { id: clientDoc.id, name: clientDoc.data()?.name, email: clientDoc.data()?.email }
        
        // Hydrating foreign relations for table
        if (sub.service_id) {
          const s = await getDoc(doc(db, 'companies', getCompanyId(), 'services', sub.service_id))
          if (s.exists()) sub.services = { name: s.data()?.name, price: s.data()?.price }
        }
        if (sub.subscription_plan_id) {
           const p = await getDoc(doc(db, 'companies', getCompanyId(), 'subscription_plans', sub.subscription_plan_id))
           if (p.exists()) sub.subscription_plans = { name: p.data()?.name, price: p.data()?.price }
        }
        hydratedSubs.push(sub)
      }
      return hydratedSubs
    })
    
    const allSubsArrays = await Promise.all(promises)
    for (const arr of allSubsArrays) {
      results.push(...arr)
    }

    if (options?.limit) {
      results = results.slice(0, options.limit)
    }
    
    return { data: results as ClientSubscription[], error: null }
  } catch (error) {
    console.error("🔥 ERRO EM getActiveSubscriptions: ", error)
    return { data: null, error }
  }
}

export async function getSubscriptionPayments(subscriptionIds: string[], monthDate: Date): Promise<{ data: any[] | null; error: any }> {
  if (!subscriptionIds || subscriptionIds.length === 0) return { data: [], error: null }
  
  try {
    const start = startOfMonth(monthDate).toISOString()
    const end = endOfMonth(monthDate).toISOString()

    const finRef = collection(db, 'companies', getCompanyId(), 'financial_records')
    const chunks = []
    for (let i = 0; i < subscriptionIds.length; i += 10) { chunks.push(subscriptionIds.slice(i, i + 10)) }

    let results: any[] = []
    for (const chunk of chunks) {
      // Only filter by subscription ID — avoids composite index requirement
      const q = query(finRef, where('client_subscription_id', 'in', chunk))
      const snap = await getDocs(q)
      snap.forEach(d => {
        const rec = { id: d.id, ...d.data() } as any
        // Filter by date range client-side
        if (rec.payment_date >= start && rec.payment_date <= end) {
          results.push(rec)
        }
      })
    }
    console.log(`[getSubscriptionPayments] Found ${results.length} payments for month`, start.substring(0, 7))
    return { data: results, error: null }
  } catch (error) {
    console.error('[getSubscriptionPayments] Error:', error)
    return { data: null, error }
  }
}

export async function getPackagePayments(clientPackageIds: string[]): Promise<{ data: any[] | null; error: any }> {
  if (!clientPackageIds || clientPackageIds.length === 0) return { data: [], error: null }
  
  try {
    const finRef = collection(db, 'companies', getCompanyId(), 'financial_records')
    const chunks = []
    for (let i = 0; i < clientPackageIds.length; i += 10) { chunks.push(clientPackageIds.slice(i, i + 10)) }

    let results: any[] = []
    for (const chunk of chunks) {
      const q = query(finRef, where('client_package_id', 'in', chunk))
      const snap = await getDocs(q)
      snap.forEach(d => results.push({ id: d.id, ...d.data() }))
    }
    console.log(`[getPackagePayments] Found ${results.length} payments for ${clientPackageIds.length} package IDs`, results)
    return { data: results, error: null }
  } catch (error) {
    console.error('[getPackagePayments] Error:', error)
    return { data: null, error }
  }
}

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
import { subscriptionCoversMonth } from '@/shared/lib/subscriptionBilling'

export async function getActiveSubscriptions(options?: {
  limit?: number
  targetDate?: Date
}): Promise<{ data: ClientSubscription[] | null; error: any }> {
  try {
    // 1. Busca clientes para evitar o collectionGroup bloqueado nas regras de segurança
    const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')
    // Buscamos todos para garantir que clientes arquivados ainda apareçam nos meses passados
    const clientsSnap = await getDocs(query(clientsRef))

    let results: any[] = []

    // 2. Fetch subscriptions para cada cliente
    const promises = clientsSnap.docs.map(async (clientDoc) => {
      const subsRef = collection(
        db,
        'companies',
        getCompanyId(),
        'clients',
        clientDoc.id,
        'subscriptions',
      )

      let subsQuery = query(subsRef)
      if (!options?.targetDate) {
        subsQuery = query(subsRef, where('status', '==', 'active'))
      }
      const subsSnap = await getDocs(subsQuery)

      const hydratedSubs = []

      for (const docSnap of subsSnap.docs) {
        const sub = { id: docSnap.id, ...docSnap.data() } as any

        // Vigência por data de CALENDÁRIO (imune a fuso): assinatura iniciada
        // no dia 1 não aparece mais como pendente no mês anterior
        if (
          options?.targetDate &&
          !subscriptionCoversMonth(sub, options.targetDate)
        ) {
          continue
        }

        sub.clients = {
          id: clientDoc.id,
          name: clientDoc.data()?.name,
          email: clientDoc.data()?.email,
        }

        // Hydrating foreign relations for table
        if (sub.service_id) {
          const s = await getDoc(
            doc(db, 'companies', getCompanyId(), 'services', sub.service_id),
          )
          if (s.exists())
            sub.services = { name: s.data()?.name, price: s.data()?.price }
        }
        if (sub.subscription_plan_id) {
          const p = await getDoc(
            doc(
              db,
              'companies',
              getCompanyId(),
              'subscription_plans',
              sub.subscription_plan_id,
            ),
          )
          if (p.exists())
            sub.subscription_plans = {
              name: p.data()?.name,
              price: p.data()?.price,
            }
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
    console.error('Erro em getActiveSubscriptions:', error)
    return { data: null, error }
  }
}

export async function getSubscriptionPayments(
  subscriptionIds: string[],
  monthDate: Date,
): Promise<{ data: any[] | null; error: any }> {
  if (!subscriptionIds || subscriptionIds.length === 0)
    return { data: [], error: null }

  try {
    const start = startOfMonth(monthDate).toISOString()
    const end = endOfMonth(monthDate).toISOString()

    const finRef = collection(
      db,
      'companies',
      getCompanyId(),
      'financial_records',
    )
    const chunks = []
    for (let i = 0; i < subscriptionIds.length; i += 10) {
      chunks.push(subscriptionIds.slice(i, i + 10))
    }

    const results: any[] = []
    for (const chunk of chunks) {
      // Only filter by subscription ID — avoids composite index requirement
      const q = query(finRef, where('client_subscription_id', 'in', chunk))
      const snap = await getDocs(q)
      snap.forEach((d) => {
        const rec = { id: d.id, ...d.data() } as any
        // Filter by date range client-side
        if (rec.payment_date >= start && rec.payment_date <= end) {
          results.push(rec)
        }
      })
    }
    return { data: results, error: null }
  } catch (error) {
    console.error('[getSubscriptionPayments] Error:', error)
    return { data: null, error }
  }
}

export async function getPackagePayments(
  clientPackageIds: string[],
): Promise<{ data: any[] | null; error: any }> {
  if (!clientPackageIds || clientPackageIds.length === 0)
    return { data: [], error: null }

  try {
    const finRef = collection(
      db,
      'companies',
      getCompanyId(),
      'financial_records',
    )
    const chunks = []
    for (let i = 0; i < clientPackageIds.length; i += 10) {
      chunks.push(clientPackageIds.slice(i, i + 10))
    }

    const results: any[] = []
    for (const chunk of chunks) {
      const q = query(finRef, where('client_package_id', 'in', chunk))
      const snap = await getDocs(q)
      snap.forEach((d) => results.push({ id: d.id, ...d.data() }))
    }
    return { data: results, error: null }
  } catch (error) {
    console.error('[getPackagePayments] Error:', error)
    return { data: null, error }
  }
}

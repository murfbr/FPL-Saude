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
import { format, startOfMonth, endOfMonth } from 'date-fns'

import { getCompanyId } from '@/shared/lib/tenantStore'
import { subscriptionCoversMonth } from '@/shared/lib/subscriptionBilling'

/**
 * Pagamentos de mensalidade/pacote ganharam ID determinístico no commit
 * 16810d1 (10/08/2026). De 2026-09 em diante toda busca é por leitura direta;
 * até 2026-08 pode existir pagamento legado com ID aleatório e a busca cai
 * no fallback por query para os não encontrados.
 */
const DETERMINISTIC_PAYMENT_IDS_SINCE = '2026-09'

/**
 * Lista assinaturas a partir do índice plano subscriptions_index (1 query,
 * mantido por Cloud Function). Índice vazio = ainda não semeado → fallback
 * para a varredura legada clients × subcoleções.
 */
export async function getActiveSubscriptions(options?: {
  limit?: number
  targetDate?: Date
}): Promise<{ data: ClientSubscription[] | null; error: any }> {
  try {
    const companyId = getCompanyId()
    const idxSnap = await getDocs(
      collection(db, 'companies', companyId, 'subscriptions_index'),
    )
    if (idxSnap.empty) {
      return getActiveSubscriptionsLegacy(options)
    }

    // Catálogos inteiros uma vez (~dezenas de docs) para hidratar nomes/preços
    const [servicesSnap, plansSnap] = await Promise.all([
      getDocs(collection(db, 'companies', companyId, 'services')),
      getDocs(collection(db, 'companies', companyId, 'subscription_plans')),
    ])
    const services = new Map(servicesSnap.docs.map((d) => [d.id, d.data()]))
    const plans = new Map(plansSnap.docs.map((d) => [d.id, d.data()]))

    let results: any[] = []
    for (const docSnap of idxSnap.docs) {
      const sub = { ...docSnap.data(), id: docSnap.id } as any

      if (options?.targetDate) {
        // Vigência por data de CALENDÁRIO (imune a fuso)
        if (!subscriptionCoversMonth(sub, options.targetDate)) continue
      } else if (sub.status !== 'active') {
        // Sem mês-alvo: apenas ativas (mesmo filtro da varredura legada)
        continue
      }

      sub.clients = {
        id: sub.client_id,
        name: sub.client_name,
        email: sub.client_email,
      }
      const svc = sub.service_id ? services.get(sub.service_id) : undefined
      if (svc) sub.services = { name: svc.name, price: svc.price }
      const plan = sub.subscription_plan_id
        ? plans.get(sub.subscription_plan_id)
        : undefined
      if (plan) sub.subscription_plans = { name: plan.name, price: plan.price }

      results.push(sub)
    }

    if (options?.limit) results = results.slice(0, options.limit)
    return { data: results as ClientSubscription[], error: null }
  } catch (error) {
    console.error('Erro em getActiveSubscriptions:', error)
    return { data: null, error }
  }
}

/** Varredura legada (clients × subcoleções) — só roda enquanto o índice não foi semeado. */
async function getActiveSubscriptionsLegacy(options?: {
  limit?: number
  targetDate?: Date
}): Promise<{ data: ClientSubscription[] | null; error: any }> {
  const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')
  const clientsSnap = await getDocs(query(clientsRef))

  let results: any[] = []

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
}

/**
 * Pagamentos de mensalidade do mês: 1 leitura direta por assinatura
 * (ID `{subId}_{yyyy-MM}`); meses até 2026-08 completam com o fallback
 * por query para pagamentos legados de ID aleatório.
 */
export async function getSubscriptionPayments(
  subscriptionIds: string[],
  monthDate: Date,
): Promise<{ data: any[] | null; error: any }> {
  if (!subscriptionIds || subscriptionIds.length === 0)
    return { data: [], error: null }

  try {
    const monthKey = format(monthDate, 'yyyy-MM')
    const finRef = collection(
      db,
      'companies',
      getCompanyId(),
      'financial_records',
    )

    const snaps = await Promise.all(
      subscriptionIds.map((id) => getDoc(doc(finRef, `${id}_${monthKey}`))),
    )

    const results: any[] = []
    const missing: string[] = []
    snaps.forEach((s, i) => {
      if (s.exists()) results.push({ id: s.id, ...s.data() })
      else missing.push(subscriptionIds[i])
    })

    if (missing.length > 0 && monthKey < DETERMINISTIC_PAYMENT_IDS_SINCE) {
      const start = startOfMonth(monthDate).toISOString()
      const end = endOfMonth(monthDate).toISOString()
      for (let i = 0; i < missing.length; i += 10) {
        const chunk = missing.slice(i, i + 10)
        const q = query(finRef, where('client_subscription_id', 'in', chunk))
        const snap = await getDocs(q)
        snap.forEach((d) => {
          const rec = { id: d.id, ...d.data() } as any
          if (rec.payment_date >= start && rec.payment_date <= end) {
            results.push(rec)
          }
        })
      }
    }

    return { data: results, error: null }
  } catch (error) {
    console.error('[getSubscriptionPayments] Error:', error)
    return { data: null, error }
  }
}

/**
 * Pagamentos de pacote: 1 leitura direta por pacote (ID = client_package_id);
 * fallback por query para pagamentos legados de ID aleatório.
 */
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

    const snaps = await Promise.all(
      clientPackageIds.map((id) => getDoc(doc(finRef, id))),
    )

    const results: any[] = []
    const missing: string[] = []
    snaps.forEach((s, i) => {
      if (s.exists()) results.push({ id: s.id, ...s.data() })
      else missing.push(clientPackageIds[i])
    })

    if (missing.length > 0) {
      for (let i = 0; i < missing.length; i += 10) {
        const chunk = missing.slice(i, i + 10)
        const q = query(finRef, where('client_package_id', 'in', chunk))
        const snap = await getDocs(q)
        snap.forEach((d) => results.push({ id: d.id, ...d.data() }))
      }
    }

    return { data: results, error: null }
  } catch (error) {
    console.error('[getPackagePayments] Error:', error)
    return { data: null, error }
  }
}

import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as admin from 'firebase-admin'
import { db, REGION } from '../config'
import { summaryRef } from '../shared/helpers'
import {
  buildMonthlySummary,
  currentMonthKey,
  monthRangeUtc,
  previousMonthKey,
  subscriptionKeysForMonth,
  SubscriptionLike,
} from '../shared/summaryCore'

/**
 * Todas as assinaturas de todos os tenants em UMA query (Admin SDK ignora
 * rules). O client_id ausente em docs legados é derivado do path
 * (companies/{companyId}/clients/{clientId}/subscriptions/{id}).
 */
export async function fetchAllSubscriptionsByCompany(): Promise<
  Record<string, SubscriptionLike[]>
> {
  const snap = await db.collectionGroup('subscriptions').get()
  const byCompany: Record<string, SubscriptionLike[]> = {}
  for (const docSnap of snap.docs) {
    const segments = docSnap.ref.path.split('/')
    // companies/{companyId}/clients/{clientId}/subscriptions/{id}
    if (segments[0] !== 'companies' || segments[2] !== 'clients') continue
    const companyId = segments[1]
    const clientId = segments[3]
    const data = docSnap.data()
    if (!byCompany[companyId]) byCompany[companyId] = []
    byCompany[companyId].push({
      ...data,
      client_id: data.client_id || clientId,
    })
  }
  return byCompany
}

/**
 * Recalcula integralmente o sumário de um mês (verdade absoluta: sobrescreve
 * o documento). A semântica dos campos vem de summaryCore — a mesma dos
 * triggers incrementais.
 */
export async function fullRecalculation(
  companyId: string,
  monthKey: string,
  companySubscriptions: SubscriptionLike[],
): Promise<void> {
  const { startIso, endIso } = monthRangeUtc(monthKey)

  const [apptsSnap, finSnap, partnershipsSnap] = await Promise.all([
    db
      .collection('companies')
      .doc(companyId)
      .collection('appointments')
      .where('schedules.start_time', '>=', startIso)
      .where('schedules.start_time', '<=', endIso)
      .get(),
    db
      .collection('companies')
      .doc(companyId)
      .collection('financial_records')
      .where('payment_date', '>=', startIso)
      .where('payment_date', '<=', endIso)
      .get(),
    db.collection('companies').doc(companyId).collection('partnerships').get(),
  ])

  const partnershipNames: Record<string, string> = {}
  partnershipsSnap.forEach((d) => {
    partnershipNames[d.id] = (d.data().name as string) || ''
  })

  const summary = buildMonthlySummary({
    monthKey,
    appointments: apptsSnap.docs.map((d) => d.data()),
    financialRecords: finSnap.docs.map((d) => d.data()),
    subscriptionKeys: subscriptionKeysForMonth(companySubscriptions, monthKey),
    partnershipNames,
  })

  await summaryRef(companyId, monthKey).set({
    ...summary,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    last_full_recalc: admin.firestore.FieldValue.serverTimestamp(),
  })

  console.log(
    `[reconciliation] ${companyId}/${monthKey}: ${summary.total_appointments} appts, ` +
      `R$ ${summary.total_revenue.toFixed(2)} caixa, R$ ${summary.total_production_value.toFixed(2)} produção`,
  )
}

export const dailyReconciliation = onSchedule(
  {
    schedule: '0 3 * * *', // Cron: todo dia às 3h
    region: REGION,
    timeZone: 'America/Sao_Paulo',
  },
  async () => {
    const companiesSnap = await db.collection('companies').listDocuments()
    const subsByCompany = await fetchAllSubscriptionsByCompany()

    // Mês corrente + anterior: fecha a janela do último dia do mês (lançamentos
    // após as 3h) e corrige drift residual dos triggers em meses recém-fechados
    const current = currentMonthKey(new Date())
    const months = [current, previousMonthKey(current)]

    for (const companyRef of companiesSnap) {
      for (const monthKey of months) {
        try {
          await fullRecalculation(
            companyRef.id,
            monthKey,
            subsByCompany[companyRef.id] || [],
          )
        } catch (err) {
          console.error(
            `[reconciliation] Erro em ${companyRef.id}/${monthKey}:`,
            err,
          )
        }
      }
    }

    console.log(
      `[reconciliation] Concluída para ${companiesSnap.length} empresa(s) × ${months.length} mês(es)`,
    )
  },
)

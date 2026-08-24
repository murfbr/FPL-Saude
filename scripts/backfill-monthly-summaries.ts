/**
 * Backfill Monthly Summaries
 *
 * Recalcula os documentos monthly_summaries/{YYYY-MM} de cada empresa para
 * todo o histórico, usando o MESMO núcleo de agregação das Cloud Functions
 * (functions/src/shared/summaryCore.ts) — semântica e fuso (America/Sao_Paulo)
 * idênticos aos do trigger e do cron, sem terceira implementação.
 *
 * Uso:
 *   npx tsx scripts/backfill-monthly-summaries.ts            # dry-run (só imprime)
 *   npx tsx scripts/backfill-monthly-summaries.ts --write    # grava de verdade
 *
 * Pré-requisitos:
 *   - GOOGLE_APPLICATION_CREDENTIALS apontando para uma service account JSON, OU
 *   - Variáveis VITE_FIREBASE_PROJECT_ID no .env.local + ADC
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'
import * as path from 'path'
import type { SubscriptionLike } from '../functions/src/shared/summaryCore'
import * as summaryCoreNs from '../functions/src/shared/summaryCore'

// O pacote functions/ é CommonJS e a raiz é ESM: sob tsx os exports chegam
// embrulhados em .default — normalizamos antes de usar
const summaryCore =
  (summaryCoreNs as unknown as { default?: typeof summaryCoreNs }).default ??
  summaryCoreNs
const {
  buildMonthlySummary,
  currentMonthKey,
  monthKeyOf,
  monthRangeUtc,
  subscriptionKeysForMonth,
} = summaryCore

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const projectId = process.env.VITE_FIREBASE_PROJECT_ID
if (!projectId) {
  console.error('❌ VITE_FIREBASE_PROJECT_ID não encontrado no .env.local')
  process.exit(1)
}

const WRITE = process.argv.includes('--write')

initializeApp({ projectId })
const db = getFirestore()

// ─────────────────────────────────────────────────────────────────────────────

function nextMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7)
}

async function fetchCompanySubscriptions(
  companyId: string,
): Promise<SubscriptionLike[]> {
  const clientsSnap = await db
    .collection('companies')
    .doc(companyId)
    .collection('clients')
    .get()
  const subs: SubscriptionLike[] = []
  for (const clientDoc of clientsSnap.docs) {
    const subsSnap = await db
      .collection('companies')
      .doc(companyId)
      .collection('clients')
      .doc(clientDoc.id)
      .collection('subscriptions')
      .get()
    for (const subDoc of subsSnap.docs) {
      const data = subDoc.data()
      subs.push({ ...data, client_id: data.client_id || clientDoc.id })
    }
  }
  return subs
}

async function recalculateMonth(
  companyId: string,
  monthKey: string,
  subs: SubscriptionLike[],
  partnershipNames: Record<string, string>,
) {
  const { startIso, endIso } = monthRangeUtc(monthKey)

  const [apptsSnap, finSnap, expensesSnap] = await Promise.all([
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
    db
      .collection('companies')
      .doc(companyId)
      .collection('expenses')
      .where('payment_date', '>=', startIso)
      .where('payment_date', '<=', endIso)
      .get(),
  ])

  const summary = buildMonthlySummary({
    monthKey,
    appointments: apptsSnap.docs.map((d) => d.data()),
    financialRecords: finSnap.docs.map((d) => d.data()),
    subscriptionKeys: subscriptionKeysForMonth(subs, monthKey),
    partnershipNames,
    expenses: expensesSnap.docs.map((d) => d.data()),
  })

  if (WRITE) {
    await db
      .collection('companies')
      .doc(companyId)
      .collection('monthly_summaries')
      .doc(monthKey)
      .set({
        ...summary,
        updated_at: FieldValue.serverTimestamp(),
        last_full_recalc: FieldValue.serverTimestamp(),
      })
  }

  console.log(
    `  ${WRITE ? '✅' : '👁 (dry-run)'} ${monthKey}: ${summary.total_appointments} agendamentos, ` +
      `R$ ${summary.total_revenue.toFixed(2)} caixa, R$ ${summary.total_production_value.toFixed(2)} produção`,
  )
}

async function main() {
  console.log(
    `\n🔥 Backfill Monthly Summaries — Projeto: ${projectId}${WRITE ? '' : ' — DRY-RUN (use --write para gravar)'}\n`,
  )

  const companiesSnap = await db.collection('companies').get()
  const companies = companiesSnap.docs.map((d) => d.id)
  console.log(`📋 Empresas encontradas: ${companies.join(', ')}\n`)

  for (const companyId of companies) {
    console.log(`\n🏢 Processando empresa: ${companyId}`)

    // Range histórico: do dado mais antigo (agendamento OU pagamento — meses só
    // com financial_records também ganham summary) até o mês corrente
    const [oldestAppt, oldestFin, newestAppt] = await Promise.all([
      db
        .collection('companies')
        .doc(companyId)
        .collection('appointments')
        .orderBy('schedules.start_time', 'asc')
        .limit(1)
        .get(),
      db
        .collection('companies')
        .doc(companyId)
        .collection('financial_records')
        .orderBy('payment_date', 'asc')
        .limit(1)
        .get(),
      db
        .collection('companies')
        .doc(companyId)
        .collection('appointments')
        .orderBy('schedules.start_time', 'desc')
        .limit(1)
        .get(),
    ])

    const candidates: string[] = []
    const apptTime = oldestAppt.docs[0]?.data().schedules?.start_time
    const finTime = oldestFin.docs[0]?.data().payment_date
    const apptKey = apptTime ? monthKeyOf(apptTime) : null
    const finKey = finTime ? monthKeyOf(finTime) : null
    if (apptKey) candidates.push(apptKey)
    if (finKey) candidates.push(finKey)

    if (candidates.length === 0) {
      console.log('  (sem agendamentos nem registros financeiros)')
      continue
    }

    const partnershipsSnap = await db
      .collection('companies')
      .doc(companyId)
      .collection('partnerships')
      .get()
    const partnershipNames: Record<string, string> = {}
    partnershipsSnap.forEach((d) => {
      partnershipNames[d.id] = (d.data().name as string) || ''
    })

    const subs = await fetchCompanySubscriptions(companyId)

    // Vai até o mês do agendamento mais FUTURO (recorrências marcadas para
    // frente têm summary de contadores) — nunca antes do mês corrente
    const newestTime = newestAppt.docs[0]?.data().schedules?.start_time
    const newestKey = newestTime ? monthKeyOf(newestTime) : null
    const nowKey = currentMonthKey(new Date())
    const lastKey = newestKey && newestKey > nowKey ? newestKey : nowKey
    let cursor = candidates.sort()[0]
    const months: string[] = []
    while (cursor <= lastKey) {
      months.push(cursor)
      cursor = nextMonthKey(cursor)
    }

    console.log(
      `  📅 ${months.length} meses para processar (${months[0]} → ${lastKey})`,
    )

    for (const monthKey of months) {
      await recalculateMonth(companyId, monthKey, subs, partnershipNames)
    }
  }

  console.log('\n🏁 Backfill concluído.\n')
}

main().catch((err) => {
  console.error('❌ Erro no backfill:', err)
  process.exit(1)
})

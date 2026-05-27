/**
 * Backfill Monthly Summaries
 *
 * Lê todos os appointments e financial_records históricos e cria os documentos
 * monthly_summaries/{companyId}/{YYYY-MM} para cada mês encontrado.
 *
 * Uso:
 *   npx tsx scripts/backfill-monthly-summaries.ts
 *
 * Pré-requisitos:
 *   - GOOGLE_APPLICATION_CREDENTIALS apontando para uma service account JSON, OU
 *   - Variáveis VITE_FIREBASE_PROJECT_ID no .env.local
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const projectId = process.env.VITE_FIREBASE_PROJECT_ID
if (!projectId) {
  console.error('❌ VITE_FIREBASE_PROJECT_ID não encontrado no .env.local')
  process.exit(1)
}

// Inicializar com Application Default Credentials
// (funciona com `firebase login` + `gcloud auth application-default login`)
initializeApp({ projectId })
const db = getFirestore()

// ─────────────────────────────────────────────────────────────────────────────

async function recalculateMonth(companyId: string, month: Date) {
  const monthKey = format(month, 'yyyy-MM')
  const startStr = startOfMonth(month).toISOString()
  const endStr = endOfMonth(month).toISOString()

  const apptsSnap = await db
    .collection('companies').doc(companyId).collection('appointments')
    .where('schedules.start_time', '>=', startStr)
    .where('schedules.start_time', '<=', endStr)
    .get()

  const finSnap = await db
    .collection('companies').doc(companyId).collection('financial_records')
    .where('payment_date', '>=', startStr)
    .where('payment_date', '<=', endStr)
    .get()

  let totalRevenue = 0, completedAppointments = 0, cancelledAppointments = 0
  let noShowAppointments = 0, totalAppointments = 0

  const byProfessional: Record<string, any> = {}
  const byService: Record<string, any> = {}
  const byPartnership: Record<string, { name: string; clientIds: Set<string>; sessionCount: number; cancelled: number; no_show: number; revenue: number }> = {}
  const byProfessionalService: Record<string, any> = {}
  const byProfessionalPartnership: Record<string, any> = {}

  apptsSnap.forEach((docSnap) => {
    const a = docSnap.data()
    totalAppointments++

    const profId = a.professional_id as string
    const profName = a.professionals?.name || 'Desconhecido'
    const serviceId = a.service_id as string
    const serviceName = a.services?.name || 'Serviço Removido'
    const price = a.services?.price || 0
    const partnershipId = a.partnership_id as string | null

    if (!byProfessional[profId]) byProfessional[profId] = { name: profName, completed: 0, cancelled: 0, no_show: 0, revenue: 0 }
    if (!byService[serviceId]) byService[serviceId] = { name: serviceName, count: 0, cancelled: 0, no_show: 0, revenue: 0 }
    if (partnershipId && !byPartnership[partnershipId]) {
      byPartnership[partnershipId] = { name: '', clientIds: new Set(), sessionCount: 0, cancelled: 0, no_show: 0, revenue: 0 }
    }

    const profSvcId = `${profId}_${serviceId}`
    if (!byProfessionalService[profSvcId]) byProfessionalService[profSvcId] = { completed: 0, cancelled: 0, no_show: 0, revenue: 0 }

    if (partnershipId) {
      const profPartId = `${profId}_${partnershipId}`
      if (!byProfessionalPartnership[profPartId]) byProfessionalPartnership[profPartId] = { completed: 0, cancelled: 0, no_show: 0, revenue: 0 }
    }

    if (a.status === 'completed') {
      completedAppointments++
      totalRevenue += price
      byProfessional[profId].completed++
      byProfessional[profId].revenue += price
      byService[serviceId].count++
      byService[serviceId].revenue += price
      byProfessionalService[profSvcId].completed++
      byProfessionalService[profSvcId].revenue += price

      if (partnershipId) {
        byPartnership[partnershipId].clientIds.add(a.client_id)
        byPartnership[partnershipId].sessionCount++
        byPartnership[partnershipId].revenue += price
        const profPartId = `${profId}_${partnershipId}`
        byProfessionalPartnership[profPartId].completed++
        byProfessionalPartnership[profPartId].revenue += price
      }
    } else if (a.status === 'cancelled') {
      cancelledAppointments++
      byProfessional[profId].cancelled++
      byService[serviceId].cancelled++
      byProfessionalService[profSvcId].cancelled++
      if (partnershipId) {
        byPartnership[partnershipId].cancelled++
        const profPartId = `${profId}_${partnershipId}`
        byProfessionalPartnership[profPartId].cancelled++
      }
    } else if (a.status === 'no_show') {
      noShowAppointments++
      byProfessional[profId].no_show++
      byService[serviceId].no_show++
      byProfessionalService[profSvcId].no_show++
      if (partnershipId) {
        byPartnership[partnershipId].no_show++
        const profPartId = `${profId}_${partnershipId}`
        byProfessionalPartnership[profPartId].no_show++
      }
    }
  })

  let subscriptionsRevenue = 0, subscriptionsPaidCount = 0
  finSnap.forEach((docSnap) => {
    const f = docSnap.data()
    if (f.client_subscription_id) {
      subscriptionsRevenue += f.amount || 0
      subscriptionsPaidCount++
    }
  })

  const byPartnershipSerialized: Record<string, any> = {}
  for (const [id, data] of Object.entries(byPartnership)) {
    byPartnershipSerialized[id] = {
      name: data.name,
      clientCount: data.clientIds.size,
      sessionCount: data.sessionCount,
      cancelled: data.cancelled,
      no_show: data.no_show,
      revenue: data.revenue,
    }
  }

  await db
    .collection('companies').doc(companyId).collection('monthly_summaries').doc(monthKey)
    .set({
      month: monthKey,
      updated_at: FieldValue.serverTimestamp(),
      total_revenue: totalRevenue,
      completed_appointments: completedAppointments,
      cancelled_appointments: cancelledAppointments,
      no_show_appointments: noShowAppointments,
      total_appointments: totalAppointments,
      subscriptions_revenue_received: subscriptionsRevenue,
      subscriptions_paid_count: subscriptionsPaidCount,
      by_professional: byProfessional,
      by_service: byService,
      by_partnership: byPartnershipSerialized,
      by_professional_service: byProfessionalService,
      by_professional_partnership: byProfessionalPartnership,
    })

  console.log(`  ✅ ${monthKey}: ${totalAppointments} agendamentos, R$ ${totalRevenue.toFixed(2)}`)
}

async function main() {
  console.log(`\n🔥 Backfill Monthly Summaries — Projeto: ${projectId}\n`)

  // 1. Listar todas as empresas
  const companiesSnap = await db.collection('companies').get()
  const companies = companiesSnap.docs.map((d) => d.id)
  console.log(`📋 Empresas encontradas: ${companies.join(', ')}\n`)

  for (const companyId of companies) {
    console.log(`\n🏢 Processando empresa: ${companyId}`)

    // 2. Buscar o appointment mais antigo para saber o range histórico
    const oldestSnap = await db
      .collection('companies').doc(companyId).collection('appointments')
      .orderBy('schedules.start_time', 'asc')
      .limit(1)
      .get()

    if (oldestSnap.empty) {
      console.log('  (sem agendamentos)')
      continue
    }

    const oldestTime = oldestSnap.docs[0].data().schedules?.start_time
    if (!oldestTime) continue

    const oldestMonth = startOfMonth(new Date(oldestTime))
    const nowMonth = startOfMonth(new Date())

    // 3. Iterar mês a mês
    const monthCursor = new Date(oldestMonth)
    const months: Date[] = []
    while (monthCursor <= nowMonth) {
      months.push(new Date(monthCursor))
      monthCursor.setMonth(monthCursor.getMonth() + 1)
    }

    console.log(`  📅 ${months.length} meses para processar (${format(oldestMonth, 'yyyy-MM')} → ${format(nowMonth, 'yyyy-MM')})`)

    for (const month of months) {
      await recalculateMonth(companyId, month)
    }
  }

  console.log('\n✅ Backfill concluído!\n')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Erro no backfill:', err)
  process.exit(1)
})

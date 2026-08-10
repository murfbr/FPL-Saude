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

  // 1. Preparar Subscrições para identificar agendamentos
  const activeSubs = new Set<string>()
  const clientsSnap = await db.collection('companies').doc(companyId).collection('clients').get()
  for (const clientDoc of clientsSnap.docs) {
    const subsSnap = await db.collection('companies').doc(companyId).collection('clients').doc(clientDoc.id).collection('subscriptions').get()
    for (const subDoc of subsSnap.docs) {
      const sub = subDoc.data()
      if (sub.service_id) {
        activeSubs.add(`${clientDoc.id}_${sub.service_id}`)
      }
    }
  }

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

  // 2. Receita Real e Avulsa
  let totalRevenue = 0, subscriptionsRevenue = 0, subscriptionsPaidCount = 0
  const professionalIndependentRevenue: Record<string, number> = {}

  finSnap.forEach((docSnap) => {
    const f = docSnap.data()
    const amount = (f.amount as number) || 0
    totalRevenue += amount
    if (f.client_subscription_id) {
      subscriptionsRevenue += amount
      subscriptionsPaidCount++
    }

    if (!f.client_package_id && !f.client_subscription_id) {
       const profId = f.professional_id as string
       if (profId) {
          professionalIndependentRevenue[profId] = (professionalIndependentRevenue[profId] || 0) + amount
       }
    }
  })

  // 3. Métricas Operacionais (Appointments)
  let completedAppointments = 0, cancelledAppointments = 0, noShowAppointments = 0, totalAppointments = 0
  
  const byProfessional: Record<string, any> = {}
  const byService: Record<string, any> = {}
  const byPartnership: Record<string, any> = {}
  const byProfessionalService: Record<string, any> = {}
  const byProfessionalPartnership: Record<string, any> = {}

  apptsSnap.forEach((docSnap) => {
    const a = docSnap.data()
    totalAppointments++

    const profId = a.professional_id as string
    const profName = a.professionals?.name || 'Desconhecido'
    const serviceId = a.service_id as string
    const serviceName = a.services?.name || 'Serviço Removido'
    const partnershipId = a.partnership_id as string | null
    const clientId = a.client_id as string

    const isPackage = !!a.client_package_id
    const isMonthlySubscription = (a.services?.value_type === 'monthly') || activeSubs.has(`${clientId}_${serviceId}`)
    const isAvulsa = !isPackage && !isMonthlySubscription

    if (!byProfessional[profId]) {
      const indRev = professionalIndependentRevenue[profId] || 0
      byProfessional[profId] = { 
        name: profName, completed: 0, cancelled: 0, no_show: 0, 
        package_sessions: 0, subscription_sessions: 0, independent_sessions: 0,
        independent_revenue: indRev, revenue: indRev 
      }
    }
    if (!byService[serviceId]) {
      byService[serviceId] = { name: serviceName, count: 0, cancelled: 0, no_show: 0, revenue: 0, package_sessions: 0, subscription_sessions: 0, independent_sessions: 0 }
    }
    if (partnershipId && !byPartnership[partnershipId]) {
      byPartnership[partnershipId] = { name: '', clientIds: new Set(), sessionCount: 0, cancelled: 0, no_show: 0 }
    }

    const profSvcId = `${profId}_${serviceId}`
    if (!byProfessionalService[profSvcId]) {
      byProfessionalService[profSvcId] = { completed: 0, cancelled: 0, no_show: 0, package_sessions: 0, subscription_sessions: 0, independent_sessions: 0, revenue: 0 }
    }

    if (partnershipId) {
      const profPartId = `${profId}_${partnershipId}`
      if (!byProfessionalPartnership[profPartId]) {
        byProfessionalPartnership[profPartId] = { completed: 0, cancelled: 0, no_show: 0 }
      }
    }

    if (a.status === 'completed') {
      completedAppointments++
      byProfessional[profId].completed++
      byService[serviceId].count++
      byProfessionalService[profSvcId].completed++

      if (isPackage) {
        byProfessional[profId].package_sessions++
        byService[serviceId].package_sessions++
        byProfessionalService[profSvcId].package_sessions++
      } else if (isMonthlySubscription) {
        byProfessional[profId].subscription_sessions++
        byService[serviceId].subscription_sessions++
        byProfessionalService[profSvcId].subscription_sessions++
      } else {
        byProfessional[profId].independent_sessions++
        byService[serviceId].independent_sessions++
        byProfessionalService[profSvcId].independent_sessions++
        
        const price = a.services?.price || 0
        byService[serviceId].revenue += price
        byProfessionalService[profSvcId].revenue += price
      }

      if (partnershipId) {
        byPartnership[partnershipId].clientIds.add(clientId)
        byPartnership[partnershipId].sessionCount++
        const profPartId = `${profId}_${partnershipId}`
        byProfessionalPartnership[profPartId].completed++
      }
    } else if (a.status === 'cancelled') {
      cancelledAppointments++
      byProfessional[profId].cancelled++
      byService[serviceId].cancelled++
      byProfessionalService[profSvcId].cancelled++
      if (partnershipId) {
        byPartnership[partnershipId].cancelled++
        byProfessionalPartnership[`${profId}_${partnershipId}`].cancelled++
      }
    } else if (a.status === 'no_show') {
      noShowAppointments++
      byProfessional[profId].no_show++
      byService[serviceId].no_show++
      byProfessionalService[profSvcId].no_show++
      if (partnershipId) {
        byPartnership[partnershipId].no_show++
        byProfessionalPartnership[`${profId}_${partnershipId}`].no_show++
      }
    }
  })

  // Garantir profissionais apenas com receita avulsa
  for (const [profId, rev] of Object.entries(professionalIndependentRevenue)) {
    if (!byProfessional[profId]) {
      byProfessional[profId] = {
        name: 'Profissional', completed: 0, cancelled: 0, no_show: 0,
        package_sessions: 0, subscription_sessions: 0, independent_sessions: 0,
        independent_revenue: rev, revenue: rev
      }
    }
  }

  const byPartnershipSerialized: Record<string, any> = {}
  for (const [id, data] of Object.entries(byPartnership)) {
    byPartnershipSerialized[id] = {
      name: data.name,
      clientCount: data.clientIds.size,
      sessionCount: data.sessionCount,
      cancelled: data.cancelled,
      no_show: data.no_show,
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

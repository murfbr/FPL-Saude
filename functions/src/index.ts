import * as admin from 'firebase-admin'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { format, startOfMonth, endOfMonth } from 'date-fns'

admin.initializeApp()
const db = admin.firestore()

const REGION = 'southamerica-east1'

// ─────────────────────────────────────────────────────────────────────────────
// Lógica de Recálculo do Sumário Mensal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recalcula o documento monthly_summaries/{companyId}/{YYYY-MM} do zero
 * lendo todos os appointments e financial_records do mês afetado.
 *
 * Estratégia: "Snapshot recalculation" — mais simples e à prova de inconsistências
 * do que incremento (que pode ficar fora de sincronia em cenários de retry).
 */
async function recalculateMonthlySummary(companyId: string, month: Date) {
  const monthKey = format(month, 'yyyy-MM')
  const startStr = startOfMonth(month).toISOString()
  const endStr = endOfMonth(month).toISOString()

  // 1. Buscar todos os agendamentos do mês
  const apptsSnap = await db
    .collection('companies')
    .doc(companyId)
    .collection('appointments')
    .where('schedules.start_time', '>=', startStr)
    .where('schedules.start_time', '<=', endStr)
    .get()

  // 2. Buscar registros financeiros do mês
  const finSnap = await db
    .collection('companies')
    .doc(companyId)
    .collection('financial_records')
    .where('payment_date', '>=', startStr)
    .where('payment_date', '<=', endStr)
    .get()

  // 3. Agregar appointments
  let totalRevenue = 0
  let completedAppointments = 0
  let cancelledAppointments = 0
  let noShowAppointments = 0
  let totalAppointments = 0

  const byProfessional: Record<string, { name: string; completed: number; revenue: number }> = {}
  const byService: Record<string, { name: string; count: number; revenue: number }> = {}
  const byPartnership: Record<string, { name: string; clientIds: Set<string>; sessionCount: number }> = {}

  apptsSnap.forEach((docSnap) => {
    const a = docSnap.data()
    totalAppointments++

    const profId = a.professional_id as string
    const profName = (a.professionals?.name as string) || 'Desconhecido'
    const serviceId = a.service_id as string
    const serviceName = (a.services?.name as string) || 'Serviço Removido'
    const price = (a.services?.price as number) || 0
    const partnershipId = a.partnership_id as string | null

    if (!byProfessional[profId]) {
      byProfessional[profId] = { name: profName, completed: 0, revenue: 0 }
    }
    if (!byService[serviceId]) {
      byService[serviceId] = { name: serviceName, count: 0, revenue: 0 }
    }
    if (partnershipId) {
      if (!byPartnership[partnershipId]) {
        byPartnership[partnershipId] = { name: '', clientIds: new Set(), sessionCount: 0 }
      }
    }

    if (a.status === 'completed') {
      completedAppointments++
      totalRevenue += price
      byProfessional[profId].completed++
      byProfessional[profId].revenue += price
      byService[serviceId].count++
      byService[serviceId].revenue += price
      if (partnershipId) {
        byPartnership[partnershipId].clientIds.add(a.client_id as string)
        byPartnership[partnershipId].sessionCount++
      }
    } else if (a.status === 'cancelled') {
      cancelledAppointments++
    } else if (a.status === 'no_show') {
      noShowAppointments++
    }
  })

  // 4. Agregar financial_records (assinaturas/pacotes)
  let subscriptionsRevenue = 0
  let subscriptionsPaidCount = 0

  finSnap.forEach((docSnap) => {
    const f = docSnap.data()
    const amount = (f.amount as number) || 0

    // Registros vinculados a assinatura
    if (f.client_subscription_id) {
      subscriptionsRevenue += amount
      subscriptionsPaidCount++
    }
  })

  // 5. Serializar Sets para arrays (Firestore não suporta Set)
  const byPartnershipSerializer: Record<string, { name: string; clientCount: number; sessionCount: number }> = {}
  for (const [id, data] of Object.entries(byPartnership)) {
    byPartnershipSerializer[id] = {
      name: data.name,
      clientCount: data.clientIds.size,
      sessionCount: data.sessionCount,
    }
  }

  // 6. Persistir o sumário
  const summaryRef = db
    .collection('companies')
    .doc(companyId)
    .collection('monthly_summaries')
    .doc(monthKey)

  await summaryRef.set({
    month: monthKey,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),

    // KPIs gerais
    total_revenue: totalRevenue,
    completed_appointments: completedAppointments,
    cancelled_appointments: cancelledAppointments,
    no_show_appointments: noShowAppointments,
    total_appointments: totalAppointments,

    // Financeiro (assinaturas)
    subscriptions_revenue_received: subscriptionsRevenue,
    subscriptions_paid_count: subscriptionsPaidCount,

    // Breakdowns
    by_professional: byProfessional,
    by_service: byService,
    by_partnership: byPartnershipSerializer,
  })

  console.log(`[summaries] Recalculated ${companyId}/${monthKey}: ${totalAppointments} appts, R$ ${totalRevenue}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Triggers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger: qualquer escrita em appointments
 * → Recalcula o sumário do mês do agendamento afetado
 */
export const onAppointmentWrite = onDocumentWritten(
  {
    document: 'companies/{companyId}/appointments/{appointmentId}',
    region: REGION,
  },
  async (event) => {
    const companyId = event.params.companyId

    // Determinar o mês afetado (usar after ou before)
    const afterData = event.data?.after?.data()
    const beforeData = event.data?.before?.data()
    const data = afterData || beforeData

    if (!data) return

    const startTime = data.schedules?.start_time as string | undefined
    if (!startTime) return

    const month = new Date(startTime)
    if (isNaN(month.getTime())) return

    await recalculateMonthlySummary(companyId, month)
  }
)

/**
 * Trigger: qualquer escrita em financial_records
 * → Recalcula o sumário do mês do registro financeiro afetado
 */
export const onFinancialRecordWrite = onDocumentWritten(
  {
    document: 'companies/{companyId}/financial_records/{recordId}',
    region: REGION,
  },
  async (event) => {
    const companyId = event.params.companyId

    const afterData = event.data?.after?.data()
    const beforeData = event.data?.before?.data()
    const data = afterData || beforeData

    if (!data) return

    const paymentDate = data.payment_date as string | undefined
    if (!paymentDate) return

    const month = new Date(paymentDate)
    if (isNaN(month.getTime())) return

    await recalculateMonthlySummary(companyId, month)
  }
)

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

  // 3. Agregar appointments (contagem + breakdowns)
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

  // 4. Agregar financial_records — receita REAL (avulsas + assinaturas + pacotes)
  let totalRevenue = 0
  let subscriptionsRevenue = 0
  let subscriptionsPaidCount = 0

  finSnap.forEach((docSnap) => {
    const f = docSnap.data()
    const amount = (f.amount as number) || 0

    // Soma TODA receita registrada no mês
    totalRevenue += amount

    // Registros vinculados a assinatura (para breakdown separado)
    if (f.client_subscription_id) {
      subscriptionsRevenue += amount
      subscriptionsPaidCount++
    }
  })

  // 5. Calcular receita prevista de assinaturas ativas
  let expectedSubscriptionsRevenue = 0
  const clientsSnap = await db
    .collection('companies')
    .doc(companyId)
    .collection('clients')
    .where('is_active', '==', true)
    .get()

  for (const clientDoc of clientsSnap.docs) {
    const subsSnap = await db
      .collection('companies')
      .doc(companyId)
      .collection('clients')
      .doc(clientDoc.id)
      .collection('subscriptions')
      .where('status', '==', 'active')
      .get()

    for (const subDoc of subsSnap.docs) {
      const sub = subDoc.data()
      let subPrice = 0

      // Buscar preço do plano ou serviço associado
      if (sub.subscription_plan_id) {
        const planSnap = await db
          .collection('companies').doc(companyId)
          .collection('subscription_plans').doc(sub.subscription_plan_id)
          .get()
        subPrice = (planSnap.data()?.price as number) || 0
      } else if (sub.service_id) {
        const svcSnap = await db
          .collection('companies').doc(companyId)
          .collection('services').doc(sub.service_id)
          .get()
        subPrice = (svcSnap.data()?.price as number) || 0
      }

      // Proration: se a assinatura começou neste mês, calcular proporcional
      if (sub.start_date && subPrice > 0) {
        const startDate = new Date(sub.start_date as string)
        const isSameMonth =
          startDate.getFullYear() === month.getFullYear() &&
          startDate.getMonth() === month.getMonth()

        if (isSameMonth) {
          const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
          const daysActive = daysInMonth - startDate.getDate() + 1
          subPrice = Math.round((subPrice / daysInMonth) * daysActive * 100) / 100
        }
      }

      expectedSubscriptionsRevenue += subPrice
    }
  }

  // 6. Serializar Sets para arrays (Firestore não suporta Set)
  const byPartnershipSerializer: Record<string, { name: string; clientCount: number; sessionCount: number }> = {}
  for (const [id, data] of Object.entries(byPartnership)) {
    byPartnershipSerializer[id] = {
      name: data.name,
      clientCount: data.clientIds.size,
      sessionCount: data.sessionCount,
    }
  }

  // 7. Persistir o sumário
  const summaryRef = db
    .collection('companies')
    .doc(companyId)
    .collection('monthly_summaries')
    .doc(monthKey)

  await summaryRef.set({
    month: monthKey,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),

    // KPIs gerais — total_revenue agora vem dos financial_records (receita real)
    total_revenue: totalRevenue,
    completed_appointments: completedAppointments,
    cancelled_appointments: cancelledAppointments,
    no_show_appointments: noShowAppointments,
    total_appointments: totalAppointments,

    // Financeiro (assinaturas)
    subscriptions_revenue_received: subscriptionsRevenue,
    subscriptions_paid_count: subscriptionsPaidCount,
    expected_subscriptions_revenue: expectedSubscriptionsRevenue,

    // Breakdowns
    by_professional: byProfessional,
    by_service: byService,
    by_partnership: byPartnershipSerializer,
  })

  console.log(`[summaries] Recalculated ${companyId}/${monthKey}: ${totalAppointments} appts, R$ ${totalRevenue}, expected subs R$ ${expectedSubscriptionsRevenue}`)
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

/**
 * Trigger: qualquer escrita em subscriptions de um cliente
 * → Recalcula o sumário do mês corrente (assinaturas afetam o expected revenue)
 */
export const onSubscriptionWrite = onDocumentWritten(
  {
    document: 'companies/{companyId}/clients/{clientId}/subscriptions/{subscriptionId}',
    region: REGION,
  },
  async (event) => {
    const companyId = event.params.companyId
    // Recalcular o mês corrente, pois assinaturas impactam expected revenue
    await recalculateMonthlySummary(companyId, new Date())
  }
)

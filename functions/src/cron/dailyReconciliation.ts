import { onSchedule } from 'firebase-functions/v2/scheduler'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import * as admin from 'firebase-admin'
import { db, REGION } from '../config'
import { summaryRef } from '../shared/helpers'

export async function fullRecalculation(companyId: string, month: Date) {
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

  // 1. Calcular receita prevista de assinaturas ativas e mapear assinaturas (Preparação)
  let expectedSubscriptionsRevenue = 0
  const activeSubs = new Set<string>()

  const clientsSnap = await db
    .collection('companies')
    .doc(companyId)
    .collection('clients')
    .get() // removido where is_active=true para manter contabilidade passada correta

  for (const clientDoc of clientsSnap.docs) {
    const subsSnap = await db
      .collection('companies')
      .doc(companyId)
      .collection('clients')
      .doc(clientDoc.id)
      .collection('subscriptions')
      .get() // removido status=active para testar vigência

    for (const subDoc of subsSnap.docs) {
      const sub = subDoc.data()
      
      // Mapear para identificação de agendamentos
      if (sub.service_id) {
        activeSubs.add(`${clientDoc.id}_${sub.service_id}`)
      }

      // Validação de vigência da assinatura para o mês analisado
      const tStart = sub.start_date
      const tEnd = sub.end_date || sub.cancelled_at

      if (tStart && tStart > endStr) continue
      if (tEnd && tEnd < startStr) continue
      
      let subPrice = sub.amount || 0

      // Fallback para assinaturas antigas sem snapshot
      if (!subPrice) {
        if (sub.subscription_plan_id) {
          const planSnap = await db
            .collection('companies')
            .doc(companyId)
            .collection('subscription_plans')
            .doc(sub.subscription_plan_id as string)
            .get()
          subPrice = (planSnap.data()?.price as number) || 0
        } else if (sub.service_id) {
          const svcSnap = await db
            .collection('companies')
            .doc(companyId)
            .collection('services')
            .doc(sub.service_id as string)
            .get()
          subPrice = (svcSnap.data()?.price as number) || 0
        }
      }

      if (sub.start_date && subPrice > 0) {
        const startDate = new Date(sub.start_date as string)
        const isSameMonth =
          startDate.getFullYear() === month.getFullYear() &&
          startDate.getMonth() === month.getMonth()
        if (isSameMonth) {
          const daysInMonth = new Date(
            month.getFullYear(),
            month.getMonth() + 1,
            0,
          ).getDate()
          const daysActive = daysInMonth - startDate.getDate() + 1
          subPrice =
            Math.round(((subPrice / daysInMonth) * daysActive * 100) / 100)
        }
      }

      expectedSubscriptionsRevenue += subPrice
    }
  }

  // 2. Agregar financial_records (Receita Real da Clínica e Receita Avulsa do Profissional)
  let totalRevenue = 0
  let subscriptionsRevenue = 0
  let subscriptionsPaidCount = 0

  const professionalIndependentRevenue: Record<string, number> = {}

  finSnap.forEach((docSnap) => {
    const f = docSnap.data()
    const amount = (f.amount as number) || 0
    totalRevenue += amount
    if (f.client_subscription_id) {
      subscriptionsRevenue += amount
      subscriptionsPaidCount++
    }

    // Receita estritamente avulsa do profissional (não é pacote nem assinatura)
    if (!f.client_package_id && !f.client_subscription_id) {
       const profId = f.professional_id as string
       if (profId) {
          professionalIndependentRevenue[profId] = (professionalIndependentRevenue[profId] || 0) + amount
       }
    }
  })

  // 3. Agregar appointments (Métricas Operacionais)
  let completedAppointments = 0
  let cancelledAppointments = 0
  let noShowAppointments = 0
  let totalAppointments = 0

  const byProfessional: Record<string, any> = {}
  const byService: Record<string, any> = {}
  const byPartnership: Record<string, any> = {}
  const byProfessionalService: Record<string, any> = {}
  const byProfessionalPartnership: Record<string, any> = {}

  apptsSnap.forEach((docSnap) => {
    const a = docSnap.data()
    totalAppointments++

    const profId = a.professional_id as string
    const profName = (a.professionals?.name as string) || 'Desconhecido'
    const serviceId = a.service_id as string
    const serviceName = (a.services?.name as string) || 'Serviço Removido'
    const partnershipId = a.partnership_id as string | null
    const clientId = a.client_id as string

    const isPackage = !!a.client_package_id
    const isMonthlySubscription = (a.services?.value_type === 'monthly') || activeSubs.has(`${clientId}_${serviceId}`)
    const isAvulsa = !isPackage && !isMonthlySubscription

    // Iniciar dados do Profissional
    if (!byProfessional[profId]) {
      const indRev = professionalIndependentRevenue[profId] || 0
      byProfessional[profId] = { 
        name: profName, 
        completed: 0, 
        cancelled: 0, 
        no_show: 0,
        package_sessions: 0,
        subscription_sessions: 0,
        independent_sessions: 0,
        independent_revenue: indRev,
        revenue: indRev // Mantém 'revenue' como alias do avulso
      }
    }
    
    // Iniciar Serviço
    if (!byService[serviceId]) {
      byService[serviceId] = { 
        name: serviceName, 
        count: 0, 
        cancelled: 0, 
        no_show: 0, 
        revenue: 0,
        package_sessions: 0,
        subscription_sessions: 0,
        independent_sessions: 0
      }
    }
    
    // Iniciar Interseção Profissional-Serviço
    const profSvcId = `${profId}_${serviceId}`
    if (!byProfessionalService[profSvcId]) {
      byProfessionalService[profSvcId] = { completed: 0, cancelled: 0, no_show: 0, package_sessions: 0, subscription_sessions: 0, independent_sessions: 0, revenue: 0 }
    }

    // Iniciar Parceria
    if (partnershipId) {
      if (!byPartnership[partnershipId]) {
        byPartnership[partnershipId] = {
          name: '',
          clientIds: new Set(),
          sessionCount: 0,
          cancelled: 0,
          no_show: 0
        }
      }
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
        
        const price = (a.services?.price as number) || 0
        byService[serviceId].revenue += price
        byProfessionalService[profSvcId].revenue += price
      }

      if (partnershipId) {
        byPartnership[partnershipId].clientIds.add(clientId)
        byPartnership[partnershipId].sessionCount++
        byProfessionalPartnership[`${profId}_${partnershipId}`].completed++
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

  // Garantir que profissionais que apenas receberam dinheiro (sem agendamentos) apareçam
  for (const [profId, rev] of Object.entries(professionalIndependentRevenue)) {
    if (!byProfessional[profId]) {
      byProfessional[profId] = {
        name: 'Profissional',
        completed: 0,
        cancelled: 0,
        no_show: 0,
        package_sessions: 0,
        subscription_sessions: 0,
        independent_sessions: 0,
        independent_revenue: rev,
        revenue: rev
      }
    }
  }

  // 4. Serializar Sets para contagens
  const byPartnershipSerialized: Record<
    string,
    { name: string; clientCount: number; sessionCount: number; cancelled: number; no_show: number }
  > = {}
  for (const [id, data] of Object.entries(byPartnership)) {
    byPartnershipSerialized[id] = {
      name: data.name,
      clientCount: data.clientIds.size,
      sessionCount: data.sessionCount,
      cancelled: data.cancelled,
      no_show: data.no_show,
    }
  }

  // 7. Persistir (sobrescreve completamente — é a verdade absoluta)
  await summaryRef(companyId, monthKey).set({
    month: monthKey,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    last_full_recalc: admin.firestore.FieldValue.serverTimestamp(),

    total_revenue: totalRevenue,
    completed_appointments: completedAppointments,
    cancelled_appointments: cancelledAppointments,
    no_show_appointments: noShowAppointments,
    total_appointments: totalAppointments,

    subscriptions_revenue_received: subscriptionsRevenue,
    subscriptions_paid_count: subscriptionsPaidCount,
    expected_subscriptions_revenue: expectedSubscriptionsRevenue,

    by_professional: byProfessional,
    by_service: byService,
    by_partnership: byPartnershipSerialized,
    by_professional_service: byProfessionalService,
    by_professional_partnership: byProfessionalPartnership,
  })

  console.log(
    `[reconciliation] ${companyId}/${monthKey}: ${totalAppointments} appts, R$ ${totalRevenue.toFixed(2)}, expected subs R$ ${expectedSubscriptionsRevenue.toFixed(2)}`,
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

    for (const companyRef of companiesSnap) {
      try {
        await fullRecalculation(companyRef.id, new Date())
      } catch (err) {
        console.error(
          `[reconciliation] Erro em ${companyRef.id}:`,
          err,
        )
      }
    }

    console.log(
      `[reconciliation] Concluída para ${companiesSnap.length} empresa(s)`,
    )
  },
)

import * as admin from 'firebase-admin'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { format, startOfMonth, endOfMonth } from 'date-fns'

admin.initializeApp()
const db = admin.firestore()

const REGION = 'southamerica-east1'
const Inc = admin.firestore.FieldValue.increment
const ServerTs = admin.firestore.FieldValue.serverTimestamp

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function monthKeyOf(isoDate: string): string | null {
  const d = new Date(isoDate)
  return isNaN(d.getTime()) ? null : format(d, 'yyyy-MM')
}

function summaryRef(companyId: string, monthKey: string) {
  return db
    .collection('companies')
    .doc(companyId)
    .collection('monthly_summaries')
    .doc(monthKey)
}

// ─────────────────────────────────────────────────────────────────────────────
// Appointment Delta (incremental)
//
// Em vez de ler TODOS os appointments do mês, calcula apenas o DELTA (before
// vs after) e aplica via FieldValue.increment(). Custo: 0 reads de appointments.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_FIELDS: Record<string, string> = {
  completed: 'completed_appointments',
  cancelled: 'cancelled_appointments',
  no_show: 'no_show_appointments',
}

/**
 * Calcula o objeto de delta para set({merge:true}) no sumário mensal.
 * Retorna null se não houver nenhuma alteração real.
 *
 * @param before Dados do doc ANTES da escrita (undefined se criação)
 * @param after  Dados do doc DEPOIS da escrita (undefined se deleção)
 */
function appointmentDelta(
  before: FirebaseFirestore.DocumentData | undefined,
  after: FirebaseFirestore.DocumentData | undefined,
): Record<string, any> | null {
  const updates: Record<string, any> = {
    updated_at: ServerTs(),
  }

  // ── Contagem total de agendamentos ────────────────────────────────────
  if (after && !before) updates.total_appointments = Inc(1) // criação
  if (before && !after) updates.total_appointments = Inc(-1) // deleção

  // ── Contadores por status ─────────────────────────────────────────────
  const bStatus = before?.status as string | undefined
  const aStatus = after?.status as string | undefined

  // Acumula deltas por campo para evitar dupla atribuição no mesmo key
  const statusDeltas: Record<string, number> = {}
  if (bStatus && STATUS_FIELDS[bStatus]) {
    statusDeltas[STATUS_FIELDS[bStatus]] = -1
  }
  if (aStatus && STATUS_FIELDS[aStatus]) {
    const field = STATUS_FIELDS[aStatus]
    statusDeltas[field] = (statusDeltas[field] || 0) + 1
  }
  for (const [field, delta] of Object.entries(statusDeltas)) {
    if (delta !== 0) updates[field] = Inc(delta)
  }

  // ── Breakdowns (by_professional, by_service, by_partnership) ──────────
  // Breakdowns contam apenas appointments COMPLETED.
  const wasCompleted = bStatus === 'completed'
  const isCompleted = aStatus === 'completed'

  if (wasCompleted || isCompleted) {
    // Acumula deltas numéricos por ID antes de converter em FieldValue
    const profAcc: Record<
      string,
      { name: string; completed: number; revenue: number }
    > = {}
    const svcAcc: Record<
      string,
      { name: string; count: number; revenue: number }
    > = {}
    const partAcc: Record<string, { sessionCount: number }> = {}

    // Subtrair breakdown do estado anterior (se era completed)
    if (wasCompleted && before) {
      const pId = before.professional_id as string
      const sId = before.service_id as string
      const price = (before.services?.price as number) || 0
      const partnId = before.partnership_id as string | null

      if (pId) {
        profAcc[pId] = profAcc[pId] || {
          name: (before.professionals?.name as string) || '',
          completed: 0,
          revenue: 0,
        }
        profAcc[pId].completed -= 1
        profAcc[pId].revenue -= price
      }
      if (sId) {
        svcAcc[sId] = svcAcc[sId] || {
          name: (before.services?.name as string) || '',
          count: 0,
          revenue: 0,
        }
        svcAcc[sId].count -= 1
        svcAcc[sId].revenue -= price
      }
      if (partnId) {
        partAcc[partnId] = partAcc[partnId] || { sessionCount: 0 }
        partAcc[partnId].sessionCount -= 1
      }
    }

    // Adicionar breakdown do estado atual (se é completed)
    if (isCompleted && after) {
      const pId = after.professional_id as string
      const sId = after.service_id as string
      const price = (after.services?.price as number) || 0
      const partnId = after.partnership_id as string | null

      if (pId) {
        profAcc[pId] = profAcc[pId] || {
          name: (after.professionals?.name as string) || '',
          completed: 0,
          revenue: 0,
        }
        // Prioriza o nome mais recente
        profAcc[pId].name =
          (after.professionals?.name as string) || profAcc[pId].name
        profAcc[pId].completed += 1
        profAcc[pId].revenue += price
      }
      if (sId) {
        svcAcc[sId] = svcAcc[sId] || {
          name: (after.services?.name as string) || '',
          count: 0,
          revenue: 0,
        }
        svcAcc[sId].name =
          (after.services?.name as string) || svcAcc[sId].name
        svcAcc[sId].count += 1
        svcAcc[sId].revenue += price
      }
      if (partnId) {
        partAcc[partnId] = partAcc[partnId] || { sessionCount: 0 }
        partAcc[partnId].sessionCount += 1
      }
    }

    // Converter acumuladores em FieldValue.increment para o Firestore
    const profObj: Record<string, any> = {}
    for (const [id, d] of Object.entries(profAcc)) {
      if (d.completed !== 0 || d.revenue !== 0) {
        profObj[id] = { name: d.name }
        if (d.completed !== 0) profObj[id].completed = Inc(d.completed)
        if (d.revenue !== 0) profObj[id].revenue = Inc(d.revenue)
      }
    }
    if (Object.keys(profObj).length > 0) updates.by_professional = profObj

    const svcObj: Record<string, any> = {}
    for (const [id, d] of Object.entries(svcAcc)) {
      if (d.count !== 0 || d.revenue !== 0) {
        svcObj[id] = { name: d.name }
        if (d.count !== 0) svcObj[id].count = Inc(d.count)
        if (d.revenue !== 0) svcObj[id].revenue = Inc(d.revenue)
      }
    }
    if (Object.keys(svcObj).length > 0) updates.by_service = svcObj

    const partObj: Record<string, any> = {}
    for (const [id, d] of Object.entries(partAcc)) {
      if (d.sessionCount !== 0) {
        partObj[id] = { sessionCount: Inc(d.sessionCount) }
      }
    }
    if (Object.keys(partObj).length > 0) updates.by_partnership = partObj
  }

  // Se o único campo é updated_at, não há mudança real → skip write
  const hasReal = Object.keys(updates).some((k) => k !== 'updated_at')
  return hasReal ? updates : null
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER: onAppointmentWrite (incremental)
//
// ANTES:  ~190 reads por execução (query range ALL appointments + ALL fin_records)
// AGORA:  0 reads (apenas 1 write via set+merge com FieldValue.increment)
// ─────────────────────────────────────────────────────────────────────────────

export const onAppointmentWrite = onDocumentWritten(
  {
    document: 'companies/{companyId}/appointments/{appointmentId}',
    region: REGION,
  },
  async (event) => {
    const companyId = event.params.companyId
    const before = event.data?.before?.data()
    const after = event.data?.after?.data()

    const bMonth = before?.schedules?.start_time
      ? monthKeyOf(before.schedules.start_time as string)
      : null
    const aMonth = after?.schedules?.start_time
      ? monthKeyOf(after.schedules.start_time as string)
      : null

    if (!bMonth && !aMonth) return

    // Caso comum: mesmo mês (criação, atualização de status, etc.)
    if (bMonth === aMonth && aMonth) {
      const delta = appointmentDelta(before, after)
      if (delta) {
        delta.month = aMonth
        await summaryRef(companyId, aMonth).set(delta, { merge: true })
      }
      return
    }

    // Cross-month: reagendamento entre meses ou criação/deleção
    const writes: Promise<any>[] = []

    if (bMonth) {
      // Remover do mês antigo (trata como deleção naquele mês)
      const removal = appointmentDelta(before, undefined)
      if (removal) {
        removal.month = bMonth
        writes.push(
          summaryRef(companyId, bMonth).set(removal, { merge: true }),
        )
      }
    }

    if (aMonth) {
      // Adicionar no mês novo (trata como criação naquele mês)
      const addition = appointmentDelta(undefined, after)
      if (addition) {
        addition.month = aMonth
        writes.push(
          summaryRef(companyId, aMonth).set(addition, { merge: true }),
        )
      }
    }

    await Promise.all(writes)
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER: onFinancialRecordWrite (incremental)
//
// ANTES:  ~190 reads por execução (recalculava tudo inclusive appointments)
// AGORA:  0 reads (apenas 1 write com incremento/decremento da receita)
// ─────────────────────────────────────────────────────────────────────────────

export const onFinancialRecordWrite = onDocumentWritten(
  {
    document: 'companies/{companyId}/financial_records/{recordId}',
    region: REGION,
  },
  async (event) => {
    const companyId = event.params.companyId
    const before = event.data?.before?.data()
    const after = event.data?.after?.data()

    const bDate = before?.payment_date as string | undefined
    const aDate = after?.payment_date as string | undefined
    const bMonth = bDate ? monthKeyOf(bDate) : null
    const aMonth = aDate ? monthKeyOf(aDate) : null

    if (!bMonth && !aMonth) return

    // Helper: constroi delta de receita para um lado (+ ou -)
    const buildDelta = (
      data: FirebaseFirestore.DocumentData | undefined,
      sign: 1 | -1,
    ): Record<string, any> | null => {
      if (!data) return null
      const amount = (data.amount as number) || 0
      if (amount === 0) return null

      const u: Record<string, any> = {
        updated_at: ServerTs(),
        total_revenue: Inc(sign * amount),
      }

      if (data.client_subscription_id) {
        u.subscriptions_revenue_received = Inc(sign * amount)
        u.subscriptions_paid_count = Inc(sign)
      }

      return u
    }

    // Mesmo mês: calcula diferença líquida
    if (bMonth === aMonth && aMonth) {
      const bAmount = (before?.amount as number) || 0
      const aAmount = (after?.amount as number) || 0
      const diff = aAmount - bAmount

      const wasSub = !!before?.client_subscription_id
      const isSub = !!after?.client_subscription_id

      // Skip se nada mudou
      if (diff === 0 && wasSub === isSub) return

      const updates: Record<string, any> = {
        updated_at: ServerTs(),
        month: aMonth,
      }

      if (diff !== 0) updates.total_revenue = Inc(diff)

      // Tratar mudanças na flag de subscription
      if (wasSub && !isSub) {
        updates.subscriptions_revenue_received = Inc(-bAmount)
        updates.subscriptions_paid_count = Inc(-1)
      } else if (!wasSub && isSub) {
        updates.subscriptions_revenue_received = Inc(aAmount)
        updates.subscriptions_paid_count = Inc(1)
      } else if (wasSub && isSub && diff !== 0) {
        updates.subscriptions_revenue_received = Inc(diff)
      }

      await summaryRef(companyId, aMonth).set(updates, { merge: true })
      return
    }

    // Cross-month ou criação/deleção
    const writes: Promise<any>[] = []

    if (bMonth) {
      const removal = buildDelta(before, -1)
      if (removal) {
        removal.month = bMonth
        writes.push(
          summaryRef(companyId, bMonth).set(removal, { merge: true }),
        )
      }
    }

    if (aMonth) {
      const addition = buildDelta(after, 1)
      if (addition) {
        addition.month = aMonth
        writes.push(
          summaryRef(companyId, aMonth).set(addition, { merge: true }),
        )
      }
    }

    await Promise.all(writes)
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER: onSubscriptionWrite (incremental)
//
// ANTES:  ~190 reads (recalculava TUDO incluindo appointments e fin_records)
// AGORA:  1 read (busca preço do plano/serviço) + 1 write
// ─────────────────────────────────────────────────────────────────────────────

export const onSubscriptionWrite = onDocumentWritten(
  {
    document:
      'companies/{companyId}/clients/{clientId}/subscriptions/{subscriptionId}',
    region: REGION,
  },
  async (event) => {
    const companyId = event.params.companyId
    const before = event.data?.before?.data()
    const after = event.data?.after?.data()

    const wasActive = before?.status === 'active'
    const isActive = after?.status === 'active'

    // Se o estado ativo não mudou, não precisa atualizar expected revenue
    if (wasActive === isActive) return

    // Buscar preço do plano ou serviço (1 read)
    const sub = after || before
    let price = 0

    if (sub?.subscription_plan_id) {
      const planSnap = await db
        .collection('companies')
        .doc(companyId)
        .collection('subscription_plans')
        .doc(sub.subscription_plan_id as string)
        .get()
      price = (planSnap.data()?.price as number) || 0
    } else if (sub?.service_id) {
      const svcSnap = await db
        .collection('companies')
        .doc(companyId)
        .collection('services')
        .doc(sub.service_id as string)
        .get()
      price = (svcSnap.data()?.price as number) || 0
    }

    if (price === 0) return

    // Proration: se a assinatura começou neste mês, calcular proporcional
    const now = new Date()
    if (sub?.start_date) {
      const startDate = new Date(sub.start_date as string)
      const isSameMonth =
        startDate.getFullYear() === now.getFullYear() &&
        startDate.getMonth() === now.getMonth()
      if (isSameMonth) {
        const daysInMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
        ).getDate()
        const daysActive = daysInMonth - startDate.getDate() + 1
        price =
          Math.round(((price / daysInMonth) * daysActive * 100) / 100)
      }
    }

    const delta = isActive ? price : -price
    const monthKey = format(now, 'yyyy-MM')

    await summaryRef(companyId, monthKey).set(
      {
        updated_at: ServerTs(),
        month: monthKey,
        expected_subscriptions_revenue: Inc(delta),
      },
      { merge: true },
    )
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// RECONCILIAÇÃO COMPLETA (full recalculation)
//
// Roda 1x por dia via scheduled function (3h BRT).
// Reconstroi o sumário do zero para corrigir eventual drift do incremento.
// Este é o MESMO algoritmo que existia antes, mas agora roda apenas 1x/dia.
// ─────────────────────────────────────────────────────────────────────────────

async function fullRecalculation(companyId: string, month: Date) {
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

  const byProfessional: Record<
    string,
    { name: string; completed: number; revenue: number }
  > = {}
  const byService: Record<
    string,
    { name: string; count: number; revenue: number }
  > = {}
  const byPartnership: Record<
    string,
    { name: string; clientIds: Set<string>; sessionCount: number }
  > = {}

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
        byPartnership[partnershipId] = {
          name: '',
          clientIds: new Set(),
          sessionCount: 0,
        }
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

  // 4. Agregar financial_records — receita REAL
  let totalRevenue = 0
  let subscriptionsRevenue = 0
  let subscriptionsPaidCount = 0

  finSnap.forEach((docSnap) => {
    const f = docSnap.data()
    const amount = (f.amount as number) || 0
    totalRevenue += amount
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

  // 6. Serializar Sets para contagens
  const byPartnershipSerialized: Record<
    string,
    { name: string; clientCount: number; sessionCount: number }
  > = {}
  for (const [id, data] of Object.entries(byPartnership)) {
    byPartnershipSerialized[id] = {
      name: data.name,
      clientCount: data.clientIds.size,
      sessionCount: data.sessionCount,
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
  })

  console.log(
    `[reconciliation] ${companyId}/${monthKey}: ${totalAppointments} appts, R$ ${totalRevenue.toFixed(2)}, expected subs R$ ${expectedSubscriptionsRevenue.toFixed(2)}`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED: Reconciliação Diária (3h BRT)
//
// Roda a lógica completa (full recalculation) 1x por dia para corrigir
// qualquer drift acumulado pelo modelo incremental.
// ─────────────────────────────────────────────────────────────────────────────

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

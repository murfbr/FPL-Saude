/**
 * Núcleo puro da agregação de monthly_summaries — fonte única de verdade.
 *
 * Três chamadores: trigger incremental (appointmentDelta), reconciliação
 * diária (cron) e backfill (scripts/). Qualquer mudança de semântica de
 * campo acontece AQUI, nunca nos chamadores.
 *
 * Sem imports de propósito: o módulo precisa rodar em Cloud Functions
 * (commonjs/tsc), no Vitest da raiz e em scripts tsx sem nenhuma
 * dependência além do runtime JS.
 *
 * Semântica dos campos de valor (decisão de produto, ago/2026):
 *   revenue          → CAIXA avulso: preço efetivo (com desconto) das sessões
 *                      independentes concluídas — espelha os financial_records
 *                      que essas sessões geram.
 *   production_value → PRODUÇÃO: preço efetivo de TODA sessão concluída,
 *                      inclusive coberta por pacote/assinatura.
 */

// America/Sao_Paulo é UTC-3 fixo desde a abolição do horário de verão (2019).
// Quando o fuso virar configuração por tenant (financial_config), este offset
// vira parâmetro — até lá, é a única constante de fuso do sistema.
export const SP_UTC_OFFSET_MS = 3 * 60 * 60 * 1000

export type BillingType = 'package' | 'subscription' | 'independent'

export interface AppointmentLike {
  professional_id?: string
  service_id?: string
  client_id?: string
  partnership_id?: string | null
  client_package_id?: string | null
  status?: string
  entry_type?: string
  event_price?: number
  discount_amount?: number
  billing_type?: string
  professionals?: { name?: string }
  partnerships?: { name?: string }
  services?: { name?: string; price?: number; value_type?: string }
  schedules?: { start_time?: string }
}

export interface FinancialRecordLike {
  amount?: number
  payment_date?: string
  professional_id?: string
  client_package_id?: string | null
  client_subscription_id?: string | null
}

export interface ExpenseLike {
  amount?: number
  status?: string
  payment_date?: string | null
  category_id?: string | null
  category_name?: string | null
}

export interface SubscriptionLike {
  client_id?: string
  service_id?: string
  start_date?: string
  end_date?: string | null
  cancelled_at?: string | null
  status?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Datas — bucketing SEMPRE no fuso de São Paulo
// ─────────────────────────────────────────────────────────────────────────────

/** 'YYYY-MM' do instante ISO no fuso de São Paulo (null se inválido). */
export function monthKeyOf(iso: string): string | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return new Date(t - SP_UTC_OFFSET_MS).toISOString().slice(0, 7)
}

/** 'YYYY-MM-DD' do instante ISO no fuso de São Paulo (null se inválido). */
export function dayKeyOf(iso: string): string | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return new Date(t - SP_UTC_OFFSET_MS).toISOString().slice(0, 10)
}

/** 'YYYY-MM' do relógio de agora no fuso de São Paulo. */
export function currentMonthKey(now: Date): string {
  return new Date(now.getTime() - SP_UTC_OFFSET_MS).toISOString().slice(0, 7)
}

/** Chave do mês anterior a uma chave 'YYYY-MM'. */
export function previousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return d.toISOString().slice(0, 7)
}

/**
 * Janela UTC [startIso, endIso] que corresponde ao mês-calendário de São
 * Paulo. Usada nas queries por payment_date / schedules.start_time.
 */
export function monthRangeUtc(monthKey: string): {
  startIso: string
  endIso: string
} {
  const [y, m] = monthKey.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1) + SP_UTC_OFFSET_MS)
  const end = new Date(Date.UTC(y, m, 1) + SP_UTC_OFFSET_MS - 1)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

/** Último dia ('YYYY-MM-DD') de uma chave de mês. */
export function lastDayOfMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────────────────────────────────────
// Classificação e preço
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classifica a sessão. `billing_type` (gravado na conclusão) tem prioridade;
 * o fallback heurístico cobre documentos anteriores à denormalização.
 * `subscriptionKeys` (opcional) = Set de `${client_id}_${service_id}` das
 * assinaturas VIGENTES no mês analisado.
 */
export function classifyAppointment(
  appt: AppointmentLike,
  subscriptionKeys?: Set<string>,
): BillingType {
  const bt = appt.billing_type
  if (bt === 'package' || bt === 'subscription' || bt === 'independent')
    return bt
  if (appt.entry_type === 'event') return 'independent'
  if (appt.client_package_id) return 'package'
  if (appt.services?.value_type === 'monthly') return 'subscription'
  if (
    subscriptionKeys &&
    appt.client_id &&
    appt.service_id &&
    subscriptionKeys.has(`${appt.client_id}_${appt.service_id}`)
  ) {
    return 'subscription'
  }
  return 'independent'
}

/** Preço efetivo da sessão: com desconto, nunca negativo; eventos usam event_price. */
export function effectivePrice(appt: AppointmentLike): number {
  if (appt.entry_type === 'event') return appt.event_price || 0
  const price = appt.services?.price || 0
  const discount = appt.discount_amount || 0
  return Math.max(0, price - discount)
}

/**
 * Vigência de assinatura num mês, por data de CALENDÁRIO (imune a fuso):
 * compara apenas o trecho 'YYYY-MM-DD' das ISO strings.
 */
export function subscriptionCoversMonth(
  sub: SubscriptionLike,
  monthKey: string,
): boolean {
  const firstDay = `${monthKey}-01`
  const lastDay = lastDayOfMonth(monthKey)
  const start10 = (sub.start_date || '').slice(0, 10)
  const endIso = sub.end_date || sub.cancelled_at
  const end10 = endIso ? endIso.slice(0, 10) : null

  if (start10 && start10 > lastDay) return false
  if (end10 && end10 < firstDay) return false
  // Dado sujo: sem data de fim e status não-ativo — não considerar vigente
  if (!end10 && sub.status && sub.status !== 'active') return false
  return true
}

/** Set `${client_id}_${service_id}` das assinaturas vigentes no mês. */
export function subscriptionKeysForMonth(
  subs: SubscriptionLike[],
  monthKey: string,
): Set<string> {
  const keys = new Set<string>()
  for (const sub of subs) {
    if (!sub.client_id || !sub.service_id) continue
    if (subscriptionCoversMonth(sub, monthKey))
      keys.add(`${sub.client_id}_${sub.service_id}`)
  }
  return keys
}

// ─────────────────────────────────────────────────────────────────────────────
// Agregação integral de um mês (cron e backfill)
// ─────────────────────────────────────────────────────────────────────────────

interface BreakdownStats {
  completed: number
  cancelled: number
  no_show: number
  revenue: number
  production_value: number
  package_sessions: number
  subscription_sessions: number
  independent_sessions: number
}

function emptyStats(): BreakdownStats {
  return {
    completed: 0,
    cancelled: 0,
    no_show: 0,
    revenue: 0,
    production_value: 0,
    package_sessions: 0,
    subscription_sessions: 0,
    independent_sessions: 0,
  }
}

export interface MonthlySummaryDoc {
  month: string
  total_revenue: number
  total_production_value: number
  total_expenses: number
  expenses_by_category: Record<string, { name: string; total: number }>
  completed_appointments: number
  cancelled_appointments: number
  no_show_appointments: number
  total_appointments: number
  subscriptions_revenue_received: number
  subscriptions_paid_count: number
  by_professional: Record<
    string,
    BreakdownStats & { name: string; independent_revenue: number }
  >
  by_service: Record<string, BreakdownStats & { name: string; count: number }>
  by_partnership: Record<
    string,
    BreakdownStats & { name: string; clientCount: number; sessionCount: number }
  >
  by_professional_service: Record<
    string,
    BreakdownStats & { independent_revenue: number }
  >
  by_professional_partnership: Record<
    string,
    BreakdownStats & { independent_revenue: number }
  >
}

export function buildMonthlySummary(input: {
  monthKey: string
  appointments: AppointmentLike[]
  financialRecords: FinancialRecordLike[]
  subscriptionKeys: Set<string>
  partnershipNames?: Record<string, string>
  expenses?: ExpenseLike[]
}): MonthlySummaryDoc {
  const {
    monthKey,
    appointments,
    financialRecords,
    subscriptionKeys,
    partnershipNames,
    expenses,
  } = input

  // Saídas — regime de caixa: só despesa PAGA, no mês do pagamento
  let totalExpenses = 0
  const expensesByCategory: Record<string, { name: string; total: number }> = {}
  for (const e of expenses || []) {
    if (e.status !== 'paid') continue
    const eAmount = e.amount || 0
    totalExpenses += eAmount
    const catId = e.category_id || 'sem-categoria'
    if (!expensesByCategory[catId]) {
      expensesByCategory[catId] = {
        name: e.category_name || 'Sem categoria',
        total: 0,
      }
    }
    expensesByCategory[catId].total += eAmount
  }

  // 1. financial_records — caixa real
  let totalRevenue = 0
  let subscriptionsRevenue = 0
  let subscriptionsPaidCount = 0
  const independentRevenueByProfessional: Record<string, number> = {}

  for (const f of financialRecords) {
    const amount = f.amount || 0
    totalRevenue += amount
    if (f.client_subscription_id) {
      subscriptionsRevenue += amount
      subscriptionsPaidCount++
    }
    if (
      !f.client_package_id &&
      !f.client_subscription_id &&
      f.professional_id
    ) {
      independentRevenueByProfessional[f.professional_id] =
        (independentRevenueByProfessional[f.professional_id] || 0) + amount
    }
  }

  // 2. appointments — operacional e produção
  let completed = 0
  let cancelled = 0
  let noShow = 0
  let total = 0
  let totalProduction = 0

  const byProfessional: MonthlySummaryDoc['by_professional'] = {}
  const byService: MonthlySummaryDoc['by_service'] = {}
  const byPartnership: MonthlySummaryDoc['by_partnership'] = {}
  const byProfSvc: MonthlySummaryDoc['by_professional_service'] = {}
  const byProfPart: MonthlySummaryDoc['by_professional_partnership'] = {}
  const partnershipClients: Record<string, Set<string>> = {}

  for (const a of appointments) {
    total++
    const profId = a.professional_id || ''
    const svcId = a.service_id || ''
    const partId = a.partnership_id || null
    const billing = classifyAppointment(a, subscriptionKeys)
    const price = effectivePrice(a)

    if (profId && !byProfessional[profId]) {
      byProfessional[profId] = {
        ...emptyStats(),
        name: a.professionals?.name || 'Desconhecido',
        independent_revenue: independentRevenueByProfessional[profId] || 0,
      }
    }
    if (svcId && !byService[svcId]) {
      byService[svcId] = {
        ...emptyStats(),
        name: a.services?.name || 'Serviço Removido',
        count: 0,
      }
    }
    if (partId && !byPartnership[partId]) {
      byPartnership[partId] = {
        ...emptyStats(),
        name: partnershipNames?.[partId] || a.partnerships?.name || '',
        clientCount: 0,
        sessionCount: 0,
      }
      partnershipClients[partId] = new Set()
    }
    const crossSvc = profId && svcId ? `${profId}_${svcId}` : null
    if (crossSvc && !byProfSvc[crossSvc]) {
      byProfSvc[crossSvc] = { ...emptyStats(), independent_revenue: 0 }
    }
    const crossPart = profId && partId ? `${profId}_${partId}` : null
    if (crossPart && !byProfPart[crossPart]) {
      byProfPart[crossPart] = { ...emptyStats(), independent_revenue: 0 }
    }

    const targets: BreakdownStats[] = []
    if (profId) targets.push(byProfessional[profId])
    if (svcId) targets.push(byService[svcId])
    if (partId) targets.push(byPartnership[partId])
    if (crossSvc) targets.push(byProfSvc[crossSvc])
    if (crossPart) targets.push(byProfPart[crossPart])

    if (a.status === 'completed') {
      completed++
      totalProduction += price
      for (const t of targets) {
        t.completed++
        t.production_value += price
        if (billing === 'package') t.package_sessions++
        else if (billing === 'subscription') t.subscription_sessions++
        else {
          t.independent_sessions++
          t.revenue += price
        }
      }
      if (svcId) byService[svcId].count++
      if (partId) {
        byPartnership[partId].sessionCount++
        if (a.client_id) partnershipClients[partId].add(a.client_id)
      }
      if (billing === 'independent') {
        if (crossSvc) byProfSvc[crossSvc].independent_revenue += price
        if (crossPart) byProfPart[crossPart].independent_revenue += price
      }
    } else if (a.status === 'cancelled') {
      cancelled++
      for (const t of targets) t.cancelled++
    } else if (a.status === 'no_show') {
      noShow++
      for (const t of targets) t.no_show++
    }
  }

  // Profissionais que só têm receita avulsa em records (sem agendamentos no mês)
  for (const [profId, rev] of Object.entries(
    independentRevenueByProfessional,
  )) {
    if (!byProfessional[profId]) {
      byProfessional[profId] = {
        ...emptyStats(),
        name: 'Profissional',
        independent_revenue: rev,
      }
    }
  }

  for (const [partId, clients] of Object.entries(partnershipClients)) {
    byPartnership[partId].clientCount = clients.size
  }

  return {
    month: monthKey,
    total_revenue: totalRevenue,
    total_production_value: totalProduction,
    total_expenses: totalExpenses,
    expenses_by_category: expensesByCategory,
    completed_appointments: completed,
    cancelled_appointments: cancelled,
    no_show_appointments: noShow,
    total_appointments: total,
    subscriptions_revenue_received: subscriptionsRevenue,
    subscriptions_paid_count: subscriptionsPaidCount,
    by_professional: byProfessional,
    by_service: byService,
    by_partnership: byPartnership,
    by_professional_service: byProfSvc,
    by_professional_partnership: byProfPart,
  }
}

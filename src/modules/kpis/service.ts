import {
  getMultipleMonthlySummaries,
  getMonthlySummary,
  MonthlySummary,
  SummaryBreakdownStats,
} from '@/modules/summaries/service'
import { getAllPartnerships } from '@/shared/services'
import { format, subMonths, startOfMonth } from 'date-fns'

interface KpiFilters {
  professionalId?: string | null
  serviceId?: string | null
  partnershipId?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para filtrar dados do sumário por profissional / serviço / parceria
// ─────────────────────────────────────────────────────────────────────────────

interface FilteredStats {
  total_revenue: number
  production_value: number
  completed_appointments: number
  cancelled_appointments: number
  no_show_appointments: number
  total_appointments: number
  package_sessions: number
  subscription_sessions: number
  independent_sessions: number
  independent_revenue: number
}

function emptyFiltered(): FilteredStats {
  return {
    total_revenue: 0,
    production_value: 0,
    completed_appointments: 0,
    cancelled_appointments: 0,
    no_show_appointments: 0,
    total_appointments: 0,
    package_sessions: 0,
    subscription_sessions: 0,
    independent_sessions: 0,
    independent_revenue: 0,
  }
}

function fromBreakdown(
  data:
    | (SummaryBreakdownStats & { count?: number; sessionCount?: number })
    | undefined,
): FilteredStats {
  if (!data) return emptyFiltered()
  const completed = data.completed ?? data.count ?? data.sessionCount ?? 0
  const cancelled = data.cancelled || 0
  const noShow = data.no_show || 0
  return {
    // revenue = caixa avulso (semântica summaryCore); docs legados podem não ter
    total_revenue: data.revenue || 0,
    production_value: data.production_value || 0,
    completed_appointments: completed,
    cancelled_appointments: cancelled,
    no_show_appointments: noShow,
    total_appointments: completed + cancelled + noShow,
    package_sessions: data.package_sessions || 0,
    subscription_sessions: data.subscription_sessions || 0,
    independent_sessions: data.independent_sessions || 0,
    // Nas matrizes cruzadas o caixa avulso é o próprio revenue
    independent_revenue: data.independent_revenue ?? data.revenue ?? 0,
  }
}

function filterSummary(
  summary: MonthlySummary,
  filters?: KpiFilters,
): FilteredStats {
  const pId =
    filters?.professionalId && filters.professionalId !== 'all'
      ? filters.professionalId
      : null
  const sId =
    filters?.serviceId && filters.serviceId !== 'all' ? filters.serviceId : null
  const partId =
    filters?.partnershipId && filters.partnershipId !== 'all'
      ? filters.partnershipId
      : null

  if (pId && sId)
    return fromBreakdown(summary.by_professional_service?.[`${pId}_${sId}`])
  if (pId && partId)
    return fromBreakdown(
      summary.by_professional_partnership?.[`${pId}_${partId}`],
    )
  if (pId) return fromBreakdown(summary.by_professional?.[pId])
  if (sId) return fromBreakdown(summary.by_service?.[sId])
  if (partId) return fromBreakdown(summary.by_partnership?.[partId])

  return {
    total_revenue: summary.total_revenue || 0,
    production_value: summary.total_production_value || 0,
    completed_appointments: summary.completed_appointments || 0,
    cancelled_appointments: summary.cancelled_appointments || 0,
    no_show_appointments: summary.no_show_appointments || 0,
    total_appointments: summary.total_appointments || 0,
    package_sessions: 0,
    subscription_sessions: 0,
    independent_sessions: 0,
    independent_revenue: 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Metrics — mês selecionado vs mês-calendário anterior
// ─────────────────────────────────────────────────────────────────────────────

export async function getKpiMetrics(
  startDate: Date,
  endDate: Date,
  filters?: KpiFilters,
) {
  try {
    // Comparação sempre contra o mês-calendário ANTERIOR ao mês exibido
    const prevMonth = startOfMonth(subMonths(startDate, 1))

    const [currRes, prevRes] = await Promise.all([
      getMonthlySummary(startDate),
      getMonthlySummary(prevMonth),
    ])

    const curr = filterSummary(currRes.data, filters)
    const prev = filterSummary(prevRes.data, filters)

    const totalCurr = curr.total_appointments || 1
    const totalPrev = prev.total_appointments || 1

    const currCancels = curr.cancelled_appointments + curr.no_show_appointments
    const prevCancels = prev.cancelled_appointments + prev.no_show_appointments

    return {
      data: {
        total_revenue: curr.total_revenue,
        prev_total_revenue: prev.total_revenue,
        production_value: curr.production_value,
        prev_production_value: prev.production_value,
        completed_appointments: curr.completed_appointments,
        prev_completed_appointments: prev.completed_appointments,
        total_appointments: curr.total_appointments,
        prev_total_appointments: prev.total_appointments,
        average_ticket:
          curr.completed_appointments > 0
            ? curr.total_revenue / curr.completed_appointments
            : 0,
        prev_average_ticket:
          prev.completed_appointments > 0
            ? prev.total_revenue / prev.completed_appointments
            : 0,
        cancellation_rate: (currCancels / totalCurr) * 100,
        prev_cancellation_rate: (prevCancels / totalPrev) * 100,
        package_sessions: curr.package_sessions,
        subscription_sessions: curr.subscription_sessions,
        independent_sessions: curr.independent_sessions,
        independent_revenue: curr.independent_revenue,
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Desempenho por Serviço
// ─────────────────────────────────────────────────────────────────────────────

export async function getServicePerformance(
  startDate: Date,
  endDate: Date,
  filters?: KpiFilters,
) {
  try {
    const { data: summary } = await getMonthlySummary(startDate)

    let entries: [
      string,
      SummaryBreakdownStats & { name?: string; count?: number },
    ][] = []

    if (filters?.professionalId && filters.professionalId !== 'all') {
      const pId = filters.professionalId
      const profSvc = summary.by_professional_service || {}
      for (const [key, val] of Object.entries(profSvc)) {
        if (key.startsWith(`${pId}_`)) {
          const sId = key.slice(pId.length + 1)
          // Pegamos o nome do by_service global
          const svcGlobal = summary.by_service?.[sId]
          entries.push([sId, { ...val, name: svcGlobal?.name || 'Serviço' }])
        }
      }
    } else {
      entries = Object.entries(summary.by_service || {})
    }

    if (filters?.serviceId && filters.serviceId !== 'all') {
      entries = entries.filter(([id]) => id === filters.serviceId)
    }

    const arr = entries.map(([id, s]) => ({
      service_id: id,
      service_name: s.name || 'Serviço',
      count: s.count ?? s.completed ?? 0,
      revenue: s.revenue || 0,
      // Docs legados não têm production_value — revenue antigo é a melhor aproximação
      production_value: s.production_value ?? s.revenue ?? 0,
    }))

    arr.sort((a, b) => b.count - a.count)
    return { data: arr, error: null }
  } catch (e) {
    return { data: [], error: e }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Desempenho por Parceria
// ─────────────────────────────────────────────────────────────────────────────

export async function getPartnershipPerformance(
  startDate: Date,
  endDate: Date,
  filters?: KpiFilters,
) {
  try {
    const { data: summary } = await getMonthlySummary(startDate)

    let entries: [
      string,
      SummaryBreakdownStats & {
        name?: string
        clientCount?: number
        sessionCount?: number
      },
    ][] = []

    if (filters?.professionalId && filters.professionalId !== 'all') {
      const pId = filters.professionalId
      const profPart = summary.by_professional_partnership || {}
      for (const [key, val] of Object.entries(profPart)) {
        if (key.startsWith(`${pId}_`)) {
          const partId = key.slice(pId.length + 1)
          entries.push([partId, val])
        }
      }
    } else {
      entries = Object.entries(summary.by_partnership || {})
    }

    if (filters?.partnershipId && filters.partnershipId !== 'all') {
      entries = entries.filter(([id]) => id === filters.partnershipId)
    }

    const { data: dbPartnerships } = await getAllPartnerships()

    const arr = entries.map(([id, p]) => {
      const dbMatch = dbPartnerships?.find((dbP) => dbP.id === id)
      return {
        partnership_id: id,
        partnership_name: dbMatch?.name || p.name || id,
        client_count: p.clientCount || 0,
        session_count: p.sessionCount ?? p.completed ?? 0,
        total_revenue: p.revenue || 0,
        production_value: p.production_value ?? p.revenue ?? 0,
      }
    })

    arr.sort((a, b) => b.session_count - a.session_count)
    return { data: arr, error: null }
  } catch (e) {
    return { data: [], error: e }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparativo Anual
// ─────────────────────────────────────────────────────────────────────────────

export async function getAnnualComparative(filters?: KpiFilters) {
  try {
    // Últimos 12 meses
    const months = Array.from({ length: 12 }, (_, i) =>
      startOfMonth(subMonths(new Date(), 11 - i)),
    )

    const { data: summaries } = await getMultipleMonthlySummaries(months)

    const resultArr = summaries.map((summary, i) => {
      const filtered = filterSummary(summary, filters)
      return {
        month: format(months[i], 'MMM/yy'),
        total_revenue: filtered.total_revenue,
        total_appointments: filtered.completed_appointments,
      }
    })

    return { data: resultArr, error: null }
  } catch (e) {
    return { data: [], error: e }
  }
}

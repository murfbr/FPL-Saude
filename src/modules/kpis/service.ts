import { getMultipleMonthlySummaries, getMonthlySummary } from '@/modules/summaries/service'
import { format, subMonths, startOfMonth } from 'date-fns'
import { getCompanyId } from '@/shared/lib/tenantStore'

interface KpiFilters {
  professionalId?: string | null
  serviceId?: string | null
  partnershipId?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para filtrar dados do sumário por profissional / serviço / parceria
// ─────────────────────────────────────────────────────────────────────────────

function filterSummary(summary: any, filters?: KpiFilters) {
  // Se não houver filtro, retorna os totais gerais
  if (!filters?.professionalId || filters.professionalId === 'all') {
    // Sem filtro de profissional — usa os totais do documento
    return {
      total_revenue: summary.total_revenue,
      completed_appointments: summary.completed_appointments,
      cancelled_appointments: summary.cancelled_appointments,
      no_show_appointments: summary.no_show_appointments,
      total_appointments: summary.total_appointments,
    }
  }

  // Com filtro de profissional — usa o breakdown by_professional
  const profData = summary.by_professional?.[filters.professionalId]
  if (!profData) {
    return { total_revenue: 0, completed_appointments: 0, cancelled_appointments: 0, no_show_appointments: 0, total_appointments: 0 }
  }
  return {
    total_revenue: profData.revenue,
    completed_appointments: profData.completed,
    // Cancelamentos não estão no breakdown por profissional — retorna 0
    cancelled_appointments: 0,
    no_show_appointments: 0,
    total_appointments: profData.completed, // aproximação com dados disponíveis
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Metrics — agora usa 2 leituras (mês atual + mês anterior)
// ─────────────────────────────────────────────────────────────────────────────

export async function getKpiMetrics(startDate: Date, endDate: Date, filters?: KpiFilters) {
  try {
    // Pega o mesmo range do tempo anterior para comparação
    const diff = endDate.getTime() - startDate.getTime()
    const prevStartDate = new Date(startDate.getTime() - diff)

    // Lê os 2 meses (paralelo)
    const [currRes, prevRes] = await Promise.all([
      getMonthlySummary(startDate),
      getMonthlySummary(prevStartDate),
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
        completed_appointments: curr.completed_appointments,
        prev_completed_appointments: prev.completed_appointments,
        total_appointments: curr.total_appointments,
        average_ticket: curr.completed_appointments > 0
          ? curr.total_revenue / curr.completed_appointments
          : 0,
        prev_average_ticket: prev.completed_appointments > 0
          ? prev.total_revenue / prev.completed_appointments
          : 0,
        cancellation_rate: (currCancels / totalCurr) * 100,
        prev_cancellation_rate: (prevCancels / totalPrev) * 100,
      },
      error: null,
    }
  } catch (error) {
    return { data: null, error }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Desempenho por Serviço — usa by_service do sumário
// ─────────────────────────────────────────────────────────────────────────────

export async function getServicePerformance(startDate: Date, endDate: Date, filters?: KpiFilters) {
  try {
    const { data: summary } = await getMonthlySummary(startDate)

    let byService = summary.by_service || {}

    // Filtrar por serviço específico se selecionado
    if (filters?.serviceId && filters.serviceId !== 'all') {
      const specific = byService[filters.serviceId]
      byService = specific ? { [filters.serviceId]: specific } : {}
    }

    const arr = Object.entries(byService).map(([id, s]) => ({
      service_id: id,
      service_name: s.name,
      count: s.count,
      revenue: s.revenue,
    }))

    arr.sort((a, b) => b.count - a.count)
    return { data: arr, error: null }
  } catch (e) {
    return { data: [], error: e }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Desempenho por Parceria — agora com dados REAIS via by_partnership
// ─────────────────────────────────────────────────────────────────────────────

export async function getPartnershipPerformance(startDate: Date, endDate: Date, filters?: KpiFilters) {
  try {
    const { data: summary } = await getMonthlySummary(startDate)

    const byPartnership = summary.by_partnership || {}

    let entries = Object.entries(byPartnership)

    // Filtrar por parceria específica se selecionada
    if (filters?.partnershipId && filters.partnershipId !== 'all') {
      entries = entries.filter(([id]) => id === filters.partnershipId)
    }

    const arr = entries.map(([id, p]) => ({
      partnership_id: id,
      partnership_name: p.name || id,
      client_count: p.clientCount,
      session_count: p.sessionCount,
    }))

    arr.sort((a, b) => b.session_count - a.session_count)
    return { data: arr, error: null }
  } catch (e) {
    return { data: [], error: e }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparativo Anual — 12 reads paralelos (era 12 loops sequenciais!)
// ─────────────────────────────────────────────────────────────────────────────

export async function getAnnualComparative(filters?: KpiFilters) {
  try {
    // Últimos 12 meses
    const months = Array.from({ length: 12 }, (_, i) =>
      startOfMonth(subMonths(new Date(), 11 - i))
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

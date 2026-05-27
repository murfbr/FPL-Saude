import { getMultipleMonthlySummaries, getMonthlySummary } from '@/modules/summaries/service'
import { getAllPartnerships, getAllServices } from '@/shared/services' // Note: may need to adjust import for getAllServices if not exported there, but let's assume it's available or we can get it from by_service
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
  const pId = filters?.professionalId && filters.professionalId !== 'all' ? filters.professionalId : null
  const sId = filters?.serviceId && filters.serviceId !== 'all' ? filters.serviceId : null
  const partId = filters?.partnershipId && filters.partnershipId !== 'all' ? filters.partnershipId : null

  if (pId && sId) {
    const data = summary.by_professional_service?.[`${pId}_${sId}`]
    if (!data) return { total_revenue: 0, completed_appointments: 0, cancelled_appointments: 0, no_show_appointments: 0, total_appointments: 0 }
    return {
      total_revenue: data.revenue,
      completed_appointments: data.completed,
      cancelled_appointments: data.cancelled || 0,
      no_show_appointments: data.no_show || 0,
      total_appointments: data.completed + (data.cancelled || 0) + (data.no_show || 0),
    }
  }

  if (pId && partId) {
    const data = summary.by_professional_partnership?.[`${pId}_${partId}`]
    if (!data) return { total_revenue: 0, completed_appointments: 0, cancelled_appointments: 0, no_show_appointments: 0, total_appointments: 0 }
    return {
      total_revenue: data.revenue,
      completed_appointments: data.completed,
      cancelled_appointments: data.cancelled || 0,
      no_show_appointments: data.no_show || 0,
      total_appointments: data.completed + (data.cancelled || 0) + (data.no_show || 0),
    }
  }

  if (pId) {
    const data = summary.by_professional?.[pId]
    if (!data) return { total_revenue: 0, completed_appointments: 0, cancelled_appointments: 0, no_show_appointments: 0, total_appointments: 0 }
    return {
      total_revenue: data.revenue,
      completed_appointments: data.completed,
      cancelled_appointments: data.cancelled || 0,
      no_show_appointments: data.no_show || 0,
      total_appointments: data.completed + (data.cancelled || 0) + (data.no_show || 0),
    }
  }

  if (sId) {
    const data = summary.by_service?.[sId]
    if (!data) return { total_revenue: 0, completed_appointments: 0, cancelled_appointments: 0, no_show_appointments: 0, total_appointments: 0 }
    return {
      total_revenue: data.revenue,
      completed_appointments: data.count,
      cancelled_appointments: data.cancelled || 0,
      no_show_appointments: data.no_show || 0,
      total_appointments: data.count + (data.cancelled || 0) + (data.no_show || 0),
    }
  }

  if (partId) {
    const data = summary.by_partnership?.[partId]
    if (!data) return { total_revenue: 0, completed_appointments: 0, cancelled_appointments: 0, no_show_appointments: 0, total_appointments: 0 }
    return {
      total_revenue: data.revenue || 0,
      completed_appointments: data.sessionCount,
      cancelled_appointments: data.cancelled || 0,
      no_show_appointments: data.no_show || 0,
      total_appointments: data.sessionCount + (data.cancelled || 0) + (data.no_show || 0),
    }
  }

  return {
    total_revenue: summary.total_revenue || 0,
    completed_appointments: summary.completed_appointments || 0,
    cancelled_appointments: summary.cancelled_appointments || 0,
    no_show_appointments: summary.no_show_appointments || 0,
    total_appointments: summary.total_appointments || 0,
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
        prev_total_appointments: prev.total_appointments,
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
// Desempenho por Serviço — cruzamento
// ─────────────────────────────────────────────────────────────────────────────

export async function getServicePerformance(startDate: Date, endDate: Date, filters?: KpiFilters) {
  try {
    const { data: summary } = await getMonthlySummary(startDate)
    
    let entries: [string, any][] = []
    
    if (filters?.professionalId && filters.professionalId !== 'all') {
      const pId = filters.professionalId
      const profSvc = summary.by_professional_service || {}
      for (const [key, val] of Object.entries(profSvc)) {
         if (key.startsWith(`${pId}_`)) {
            const sId = key.split('_')[1]
            // Pegamos o nome do by_service global
            const svcGlobal = summary.by_service?.[sId]
            entries.push([sId, { name: svcGlobal?.name || 'Serviço', count: val.completed, revenue: val.revenue }])
         }
      }
    } else {
      entries = Object.entries(summary.by_service || {})
    }

    // Filtrar por serviço específico se selecionado (redundante para gráfico, mas bom garantir)
    if (filters?.serviceId && filters.serviceId !== 'all') {
      entries = entries.filter(([id]) => id === filters.serviceId)
    }

    const arr = entries.map(([id, s]) => ({
      service_id: id,
      service_name: s.name,
      count: s.count || s.completed || 0,
      revenue: s.revenue || 0,
    }))

    arr.sort((a, b) => b.count - a.count)
    return { data: arr, error: null }
  } catch (e) {
    return { data: [], error: e }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Desempenho por Parceria — cruzamento
// ─────────────────────────────────────────────────────────────────────────────

export async function getPartnershipPerformance(startDate: Date, endDate: Date, filters?: KpiFilters) {
  try {
    const { data: summary } = await getMonthlySummary(startDate)

    let entries: [string, any][] = []
    
    if (filters?.professionalId && filters.professionalId !== 'all') {
      const pId = filters.professionalId
      const profPart = summary.by_professional_partnership || {}
      for (const [key, val] of Object.entries(profPart)) {
         if (key.startsWith(`${pId}_`)) {
            const partId = key.split('_')[1]
            entries.push([partId, { sessionCount: val.completed, revenue: val.revenue, clientCount: 0 }])
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
      const dbMatch = dbPartnerships?.find(dbP => dbP.id === id)
      return {
        partnership_id: id,
        partnership_name: dbMatch?.name || p.name || id,
        client_count: p.clientCount || 0,
        session_count: p.sessionCount || 0,
        total_revenue: p.revenue || 0,
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

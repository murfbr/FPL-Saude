import { db } from '@/shared/lib/firebase'
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore'
import { format, subDays, startOfMonth, subMonths, endOfMonth } from 'date-fns'

import { getCompanyId } from '@/shared/lib/tenantStore'

interface KpiFilters {
  professionalId?: string | null
  serviceId?: string | null
  partnershipId?: string | null
}

let cachedBaseAppts: any = null
let cacheTime = 0

async function fetchAllAppointmentsBase(filters?: KpiFilters) {
  const now = Date.now()
  const cacheKey = `${getCompanyId()}:${JSON.stringify(filters || {})}`

  if (cachedBaseAppts && cachedBaseAppts.key === cacheKey && now - cacheTime < 5000) {
    return cachedBaseAppts.data
  }

  const apptsRef = collection(db, 'companies', getCompanyId(), 'appointments')
  const qParts: any[] = []
  if (filters?.professionalId && filters.professionalId !== 'all') {
    qParts.push(where('professional_id', '==', filters.professionalId))
  }
  const q = query(apptsRef, ...qParts)

  const snap = await getDocs(q)
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }))

  cachedBaseAppts = { key: cacheKey, data: results }
  cacheTime = now
  return results
}

async function fetchAppointments(startStr: string, endStr: string, filters?: KpiFilters) {
  const baseAppts = await fetchAllAppointmentsBase(filters)
  const results: any[] = []

  // Mem filter
  for (const data of baseAppts) {
    if (data.schedules?.start_time >= startStr && data.schedules?.start_time <= endStr) {
      if (filters?.serviceId && filters.serviceId !== 'all' && data.service_id !== filters.serviceId) continue
      results.push(data)
    }
  }

  // Hydrate services price & name for revenue math (using denormalized data when available)
  const hydrated = await Promise.all(results.map(async (r: any) => {
    // Check if we already have the denormalized data from our NoSQL optimization
    if (r.services?.name && r.services?.price !== undefined) {
      return r
    }

    if (r.service_id) {
      // Legacy Fallback: Only read if denormalization hasn't happened yet
      const sSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'services', r.service_id))
      r.services = { name: sSnap.data()?.name, price: sSnap.data()?.price || 0 }
    }
    return r
  }))
  return hydrated
}

export async function getKpiMetrics(startDate: Date, endDate: Date, filters?: KpiFilters) {
  try {
    const startStr = startDate.toISOString()
    const endStr = endDate.toISOString()

    // Pega o mesmo range do tempo anterior para comparação
    const diff = endDate.getTime() - startDate.getTime()
    const prevStartDate = new Date(startDate.getTime() - diff)
    const prevEndDate = new Date(endDate.getTime() - diff)

    const currAppts = await fetchAppointments(startStr, endStr, filters)
    const prevAppts = await fetchAppointments(prevStartDate.toISOString(), prevEndDate.toISOString(), filters)

    // Agregações Cur
    let rev = 0, compAppts = 0, cancels = 0
    currAppts.forEach(a => {
      if (a.status === 'completed') { rev += (a.services?.price || 0); compAppts++ }
      if (a.status === 'cancelled' || a.status === 'no_show') cancels++
    })

    // Agregações Prev
    let prevRev = 0, prevCompAppts = 0, prevCancels = 0
    prevAppts.forEach(a => {
      if (a.status === 'completed') { prevRev += (a.services?.price || 0); prevCompAppts++ }
      if (a.status === 'cancelled' || a.status === 'no_show') prevCancels++
    })

    const totalCurr = currAppts.length || 1
    const totalPrev = prevAppts.length || 1

    return {
      data: {
        total_revenue: rev,
        prev_total_revenue: prevRev,
        completed_appointments: compAppts,
        prev_completed_appointments: prevCompAppts,
        total_appointments: currAppts.length,
        average_ticket: compAppts > 0 ? (rev / compAppts) : 0,
        prev_average_ticket: prevCompAppts > 0 ? (prevRev / prevCompAppts) : 0,
        retention_rate: 80, // Mock for NoSQL MVP
        prev_retention_rate: 75,
        cancellation_rate: (cancels / totalCurr) * 100,
        prev_cancellation_rate: (prevCancels / totalPrev) * 100
      }, error: null
    }
  } catch (error) { return { data: null, error } }
}

export async function getServicePerformance(startDate: Date, endDate: Date, filters?: KpiFilters) {
  try {
    const appts = await fetchAppointments(startDate.toISOString(), endDate.toISOString(), filters)
    const countMap: Record<string, number> = {}

    appts.forEach(a => {
      const sName = a.services?.name || 'Serviço Deletado'
      if (a.status !== 'cancelled' && a.status !== 'no_show') {
        countMap[sName] = (countMap[sName] || 0) + 1
      }
    })

    const arr = Object.keys(countMap).map(k => ({ service_name: k, count: countMap[k] }))
    arr.sort((a, b) => b.count - a.count)
    return { data: arr, error: null }
  } catch (e) { return { data: [], error: e } }
}

export async function getPartnershipPerformance(startDate: Date, endDate: Date, filters?: KpiFilters) {
  // Mock simplificado. A versão real requereria buscar os clientes, cruzar com a parceria...
  return {
    data: [
      { partnership_name: 'Gympass', client_count: 5, total_revenue: 500 },
      { partnership_name: 'Unimed', client_count: 3, total_revenue: 300 }
    ],
    error: null
  }
}

export async function getAnnualComparative(filters?: KpiFilters) {
  try {
    const resultArr = []

    // Volta 12 meses
    for (let i = 11; i >= 0; i--) {
      const date = subMonths(new Date(), i)
      const st = startOfMonth(date).toISOString()
      const ed = endOfMonth(date).toISOString()

      const appts = await fetchAppointments(st, ed, filters)

      let rev = 0, count = 0
      appts.forEach(a => {
        if (a.status === 'completed') {
          rev += (a.services?.price || 0)
          count++
        }
      })

      resultArr.push({ month: format(date, 'MMM/yy'), total_revenue: rev, total_appointments: count })
    }

    return { data: resultArr, error: null }
  } catch (e) { return { data: [], error: e } }
}

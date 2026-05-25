import { db } from '@/shared/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { RecurringAvailability, AvailabilityOverride, BlockedDate } from '@/shared/types'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { computeSlotsForDay } from '@/shared/lib/availability-logic'
import { getAppointmentsByProfessionalForRange } from '../../appointments/service'
import { getServiceById } from '../../services-catalog/service'

import { getCompanyId } from '@/shared/lib/tenantStore'

export async function getRecurringAvailability(
  professionalId: string,
): Promise<{
  data: RecurringAvailability[] | null
  error: any
}> {
  try {
    const ref = collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'recurring_availability')
    const snapshot = await getDocs(ref)
    const data: RecurringAvailability[] = []
    snapshot.forEach(d => {
      data.push({ id: d.id, ...d.data() } as RecurringAvailability)
    })
    data.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getAvailabilityOverrides(
  professionalId: string,
  month: Date,
): Promise<{ data: AvailabilityOverride[] | null; error: any }> {
  try {
    const startDate = format(startOfMonth(month), 'yyyy-MM-dd')
    const endDate = format(endOfMonth(month), 'yyyy-MM-dd')

    const ref = collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'availability_overrides')
    const q = query(ref, where('override_date', '>=', startDate), where('override_date', '<=', endDate))
    const snapshot = await getDocs(q)

    const data: AvailabilityOverride[] = []
    snapshot.forEach(d => {
      data.push({ id: d.id, ...d.data() } as AvailabilityOverride)
    })
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getAvailabilityOverridesForRange(
  professionalId: string,
  startDate: Date,
  endDate: Date,
): Promise<{ data: AvailabilityOverride[] | null; error: any }> {
  try {
    const startStr = format(startDate, 'yyyy-MM-dd')
    const endStr = format(endDate, 'yyyy-MM-dd')

    const ref = collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'availability_overrides')
    const q = query(ref, where('override_date', '>=', startStr), where('override_date', '<=', endStr))
    const snapshot = await getDocs(q)

    const data: AvailabilityOverride[] = []
    snapshot.forEach(d => {
      data.push({ id: d.id, ...d.data() } as AvailabilityOverride)
    })
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getGlobalBlockedDates(): Promise<{ data: BlockedDate[] | null; error: any }> {
  try {
    const ref = collection(db, 'companies', getCompanyId(), 'blocked_dates')
    const snapshot = await getDocs(ref)
    const data: BlockedDate[] = []
    snapshot.forEach(d => {
      data.push({ id: d.id, ...d.data() } as BlockedDate)
    })
    // Sort by date (this will be a bit tricky with mixed YYYY-MM-DD and MM-DD, but let's keep it simple for now)
    data.sort((a, b) => a.date.localeCompare(b.date))
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// Client-side dynamic available dates calculator
export async function getAvailableDatesForRange(
  professionalId: string,
  serviceId: string,
  startDate: Date,
  endDate: Date,
): Promise<{ data: string[] | null; error: any }> {
  try {
    // 1. Fetch ALL data for the range in BATCH (5 queries total instead of 5 * days)
    const [
      { data: recurring },
      { data: overrides },
      { data: appointments },
      { data: service },
      { data: globalBlockedDates }
    ] = await Promise.all([
      getRecurringAvailability(professionalId),
      getAvailabilityOverridesForRange(professionalId, startDate, endDate),
      getAppointmentsByProfessionalForRange(professionalId, startDate.toISOString(), endDate.toISOString()),
      getServiceById(serviceId),
      getGlobalBlockedDates()
    ])

    if (!recurring || !overrides || !appointments || !service) {
      return { data: null, error: 'Erro ao carregar dados de disponibilidade' }
    }

    const availabilityData = {
      recurring: recurring || [],
      overrides: overrides || [],
      appointments: appointments || [],
      service: service,
      globalBlockedDates: globalBlockedDates || []
    }

    const availableDates: string[] = []

    // 2. Compute slots for each day in memory (Zero Firestore reads here!)
    let currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const slots = computeSlotsForDay(currentDate, availabilityData, professionalId)
      if (slots.length > 0) {
        availableDates.push(format(currentDate, 'yyyy-MM-dd'))
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return { data: availableDates, error: null }
  } catch (error) {
    console.error('Error calculating available dates in batch:', error)
    return { data: null, error }
  }
}

export async function getAvailableDatesForProfessional(
  professionalId: string,
  serviceId: string,
  month: Date,
): Promise<{ data: string[] | null; error: any }> {
  const startDate = startOfMonth(month)
  const endDate = endOfMonth(month)

  return getAvailableDatesForRange(
    professionalId,
    serviceId,
    startDate,
    endDate,
  )
}

import { Schedule, Professional, Appointment, Service } from '@/shared/types'
import { format, parseISO, isBefore, isAfter, addMinutes, setHours, setMinutes, startOfDay, endOfDay } from 'date-fns'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'

import { getServiceById } from '../services-catalog/service'
import { getAppointmentsByProfessionalForRange } from './service'
import { getRecurringAvailability, getAvailabilityOverridesForRange, getGlobalBlockedDates } from '../availability/service'
import { getAllProfessionals, getProfessionalsByService } from '../professionals/service'
import { computeSlotsForDay } from '@/shared/lib/availability-logic'

const TIMEZONE = 'America/Sao_Paulo'

export async function getFilteredAvailableSchedules(
  professionalId: string,
  serviceId: string,
  date: Date,
  excludeAppointmentId?: string,
): Promise<{ data: Schedule[] | null; error: any }> {
  try {
    const dateStr = format(date, 'yyyy-MM-dd')

    // 1. Fetch Service to get duration
    const { data: service } = await getServiceById(serviceId)
    if (!service) throw new Error('Serviço não encontrado')
    const durationMins = service.duration_minutes || 60

    // 2. Fetch Availability Rules & Appointments concurrently
    const startOfD = startOfDay(date)
    const endOfD = endOfDay(date)

    const [
      { data: recurring },
      { data: overrides },
      { data: appointments },
      { data: globalBlockedDates }
    ] = await Promise.all([
      getRecurringAvailability(professionalId),
      getAvailabilityOverridesForRange(professionalId, date, date),
      getAppointmentsByProfessionalForRange(professionalId, startOfD.toISOString(), endOfD.toISOString()),
      getGlobalBlockedDates()
    ])

    if (!recurring || !overrides || !appointments) {
      return { data: [], error: 'Erro ao buscar dados de disponibilidade' }
    }

    // 3. Use utility to compute slots
    const candidateSlots = computeSlotsForDay(date, {
      recurring: recurring || [],
      overrides: overrides || [],
      appointments: appointments || [],
      service: service,
      excludeAppointmentId,
      globalBlockedDates: globalBlockedDates || []
    }, professionalId)

    return { data: candidateSlots, error: null }

  } catch (error) {
    console.error('Error calculating dynamic schedules:', error)
    return { data: null, error }
  }
}

export async function getAvailableSchedules(
  professionalId: string,
  serviceId: string,
  date: Date,
): Promise<{ data: Schedule[] | null; error: any }> {
  return getFilteredAvailableSchedules(professionalId, serviceId, date)
}

export async function getAvailableProfessionalsAtSlot(
  serviceId: string,
  date: Date,
): Promise<{ data: Professional[] | null; error: any }> {
  try {
    // 1. Otimizamos para buscar apenas profissionais compatíveis, protegendo do erro de schema.
    const { data: prosWithService } = await getProfessionalsByService(serviceId)
    if (!prosWithService || prosWithService.length === 0) return { data: [], error: null }

    const targetTime = formatInTimeZone(date, 'America/Sao_Paulo', 'HH:mm')

    // 2. We use Promise.all to fetch availability for all professionals AT THE SAME TIME (concurrently).
    // This reduces the network time from e.g. (10 pros * 500ms = 5000ms) down to just ~500ms total.
    const availabilityChecks = prosWithService.map(async (pro) => {
      const { data: slots } = await getFilteredAvailableSchedules(pro.id, serviceId, date)
      
      const isAvailable = slots?.some(s => {
        const slotTime = formatInTimeZone(new Date(s.start_time), 'America/Sao_Paulo', 'HH:mm')
        return slotTime === targetTime
      })

      return isAvailable ? pro : null
    })

    const results = await Promise.all(availabilityChecks)
    
    // 3. Filter out nulls
    const availablePros = results.filter((pro): pro is Professional => pro !== null)
    console.log(`[DEBUG] getAvailableProfessionalsAtSlot(${targetTime}): Found ${availablePros.length} available professionals out of ${prosWithService.length} total.`, availablePros.map(p => p.name))
    return { data: availablePros, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getScheduleIdForSlot(
  professionalId: string,
  date: Date,
): Promise<{ data: string | null; error: any }> {
  // In the dynamic generation there is no real schedule ID, we return null so the appointment logic knows it's dynamic
  return { data: null, error: null }
}

export async function getAvailableProfessionalsForSlot(
  date: Date,
): Promise<{ data: Professional[] | null; error: any }> {
  return { data: [], error: null }
}

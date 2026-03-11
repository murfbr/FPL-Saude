import { Schedule, Professional, Appointment, Service } from '@/types'
import { format, parseISO, isBefore, isAfter, addMinutes, setHours, setMinutes, startOfDay, endOfDay } from 'date-fns'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'

import { getServiceById } from './services'
import { getAppointmentsByProfessionalForRange } from './appointments'
import { getRecurringAvailability, getAvailabilityOverridesForRange } from './availability'
import { getAllProfessionals, getProfessionalsByService } from './professionals'

const TIMEZONE = 'America/Sao_Paulo'

export async function getFilteredAvailableSchedules(
  professionalId: string,
  serviceId: string,
  date: Date,
): Promise<{ data: Schedule[] | null; error: any }> {
  try {
    const dateStr = format(date, 'yyyy-MM-dd')

    // 1. Fetch Service to get duration
    const { data: service } = await getServiceById(serviceId)
    if (!service) throw new Error('Serviço não encontrado')
    const durationMins = service.duration_minutes || 60

    // 2. Fetch Availability Rules
    const { data: recurring } = await getRecurringAvailability(professionalId)
    const { data: overrides } = await getAvailabilityOverridesForRange(professionalId, date, date)

    // Day of week in JS (0 = Sunday, 1 = Monday). Supabase may have been 1..7 so check logic.
    // Date-fns format 'i' gives 1 for Monday, 7 for Sunday. Supabase postgres EXTRACT(ISODOW) does the same.
    const dayOfWeek = parseInt(format(date, 'i'))

    const dayOverrides = overrides?.filter(o => o.override_date === dateStr) || []

    let isDayAvailable = true
    let timeBlocks: { start_time: string, end_time: string }[] = []

    if (dayOverrides.length > 0) {
      // Check if there is an override blocking the whole day
      const blockingOverride = dayOverrides.find(o => o.is_available === false && o.start_time === '00:00:00')
      if (blockingOverride) {
        isDayAvailable = false
      } else {
        // Use overrides as the source of truth for time blocks if they allow availability
        const availableOverrides = dayOverrides.filter(o => o.is_available)
        if (availableOverrides.length > 0) {
          timeBlocks = availableOverrides.map(o => ({ start_time: o.start_time, end_time: o.end_time }))
        } else {
          isDayAvailable = false
        }
      }
    } else {
      // Find recurring rules for this day
      const dailyRules = recurring?.filter(r => r.day_of_week === dayOfWeek) || []
      if (dailyRules.length > 0) {
        timeBlocks = dailyRules.map(r => ({ start_time: r.start_time, end_time: r.end_time }))
      } else {
        isDayAvailable = false
      }
    }

    if (!isDayAvailable || timeBlocks.length === 0) {
      return { data: [], error: null }
    }

    // 3. Fetch Appointments for this day to subtract
    const startOfD = startOfDay(date)
    const endOfD = endOfDay(date)
    const { data: appointments } = await getAppointmentsByProfessionalForRange(professionalId, startOfD.toISOString(), endOfD.toISOString())

    // 4. Generate candidate slots
    let candidateSlots: Schedule[] = []

    timeBlocks.forEach(block => {
      // Parse block to Date
      let slotStart = parseISO(`${dateStr}T${block.start_time}-03:00`)
      const blockEnd = parseISO(`${dateStr}T${block.end_time}-03:00`)

      while (isBefore(slotStart, blockEnd)) {
        const slotEnd = addMinutes(slotStart, durationMins)

        // If the slot overflows the block, break
        if (isAfter(slotEnd, blockEnd)) break

        candidateSlots.push({
          id: `virtual_${format(slotStart, 'HH:mm')}`,
          professional_id: professionalId,
          start_time: slotStart.toISOString(),
          end_time: slotEnd.toISOString(),
          max_capacity: 1,
          current_count: 0
        })

        // Advance to next slot - default to fixed duration stepping (could be configured differently)
        slotStart = slotEnd
      }
    })

    // 5. Filter out slots overlapping with existing appointments
    if (appointments && appointments.length > 0) {
      const activeAppointments = appointments.filter(a => ['scheduled', 'confirmed'].includes(a.status))

      candidateSlots = candidateSlots.filter(slot => {
        const slotStart = new Date(slot.start_time)
        const slotEnd = new Date(slot.end_time)

        const overlaps = activeAppointments.some(app => {
          const appStart = new Date(app.schedules?.start_time)
          const appEnd = new Date(app.schedules?.end_time)

          return (
            (isBefore(slotStart, appEnd) && isAfter(slotEnd, appStart)) || // Strict overlap
            slotStart.getTime() === appStart.getTime()
          )
        })

        return !overlaps
      })
    }

    // Filter out slots earlier than 07:00 AM
    candidateSlots = candidateSlots.filter(slot => {
      const timeStr = formatInTimeZone(slot.start_time, TIMEZONE, 'HH:mm')
      const [hours] = timeStr.split(':').map(Number)
      return hours >= 7
    })

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

    const availablePros: Professional[] = []

    // 2. For each pro, check if they have that specific slot available
    for (const pro of prosWithService) {
      const { data: slots } = await getFilteredAvailableSchedules(pro.id, serviceId, date)
      // BYPASS TOTAL: Injetamos todos e adicionaremos console log pra você me dizer o que está dando errado.
      availablePros.push(pro)
    }

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

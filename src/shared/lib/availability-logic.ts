import { Schedule, RecurringAvailability, AvailabilityOverride, Appointment, Service } from '@/shared/types'
import { format, parseISO, isBefore, isAfter, addMinutes, startOfDay, endOfDay } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

const TIMEZONE = 'America/Sao_Paulo'

export interface AvailabilityData {
  recurring: RecurringAvailability[]
  overrides: AvailabilityOverride[]
  appointments: Appointment[]
  service: Service
  excludeAppointmentId?: string
}

/**
 * Pure function to compute available slots for a single day based on provided data.
 */
export function computeSlotsForDay(
  date: Date,
  data: AvailabilityData,
  professionalId: string
): Schedule[] {
  const dateStr = format(date, 'yyyy-MM-dd')
  const durationMins = data.service.duration_minutes || 60
  const dayOfWeek = parseInt(format(date, 'i'))

  const dayOverrides = data.overrides.filter(o => o.override_date === dateStr)
  
  let isDayAvailable = true
  let timeBlocks: { start_time: string, end_time: string }[] = []

  if (dayOverrides.length > 0) {
    const blockingOverride = dayOverrides.find(o => o.is_available === false && o.start_time === '00:00:00')
    if (blockingOverride) {
      isDayAvailable = false
    } else {
      const availableOverrides = dayOverrides.filter(o => o.is_available)
      if (availableOverrides.length > 0) {
        timeBlocks = availableOverrides.map(o => ({ start_time: o.start_time, end_time: o.end_time }))
      } else {
        isDayAvailable = false
      }
    }
  } else {
    const dailyRules = data.recurring.filter(r => r.day_of_week === dayOfWeek)
    if (dailyRules.length > 0) {
      timeBlocks = dailyRules.map(r => ({ start_time: r.start_time, end_time: r.end_time }))
    } else {
      isDayAvailable = false
    }
  }

  if (!isDayAvailable || timeBlocks.length === 0) {
    return []
  }

  let candidateSlots: Schedule[] = []

  timeBlocks.forEach(block => {
    let slotStart = parseISO(`${dateStr}T${block.start_time}-03:00`)
    const blockEnd = parseISO(`${dateStr}T${block.end_time}-03:00`)

    while (isBefore(slotStart, blockEnd)) {
      const slotEnd = addMinutes(slotStart, durationMins)
      if (isAfter(slotEnd, blockEnd)) break

      candidateSlots.push({
        id: `virtual_${format(slotStart, 'HH:mm')}`,
        professional_id: professionalId,
        start_time: slotStart.toISOString(),
        end_time: slotEnd.toISOString(),
        max_capacity: data.service.max_attendees || 1,
        current_count: 0
      })

      slotStart = slotEnd
    }
  })

  // Filter overlapping appointments
  const dayAppointments = data.appointments.filter(app => {
    if (!app.schedules?.start_time) return false
    const appDate = format(new Date(app.schedules.start_time), 'yyyy-MM-dd')
    return appDate === dateStr && 
           ['scheduled', 'confirmed'].includes(app.status) &&
           app.id !== data.excludeAppointmentId
  })

  if (dayAppointments.length > 0) {
    candidateSlots = candidateSlots.filter(slot => {
      const slotStart = new Date(slot.start_time)
      const slotEnd = new Date(slot.end_time)

      const overlapping = dayAppointments.filter(app => {
        const appStart = new Date(app.schedules!.start_time!)
        const appEnd = new Date(app.schedules!.end_time!)
        return (isBefore(slotStart, appEnd) && isAfter(slotEnd, appStart)) || 
               slotStart.getTime() === appStart.getTime()
      })

      slot.current_count = overlapping.length
      return overlapping.length < slot.max_capacity!
    })
  }

  // Business hours filter (07:00 - 20:00)
  return candidateSlots.filter(slot => {
    const timeStr = formatInTimeZone(slot.start_time, TIMEZONE, 'HH:mm')
    const [hours] = timeStr.split(':').map(Number)
    return hours >= 7 && hours < 20
  })
}

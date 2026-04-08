import { Schedule, RecurringAvailability, AvailabilityOverride, Appointment, Service, BlockedDate } from '@/shared/types'
import { format, parseISO, isBefore, isAfter, addMinutes, startOfDay, endOfDay } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

const TIMEZONE = 'America/Sao_Paulo'

export interface AvailabilityData {
  recurring: RecurringAvailability[]
  overrides: AvailabilityOverride[]
  appointments: Appointment[]
  service: Service
  excludeAppointmentId?: string
  globalBlockedDates?: BlockedDate[]
}

/**
 * Pure function to compute available slots for a single day based on provided data.
 */
export function computeSlotsForDay(
  date: Date,
  data: AvailabilityData,
  professionalId: string
): Schedule[] {
  console.group(`[Availability DEBUG] computeSlotsForDay - Prof: ${professionalId}`)
  const dateStr = format(date, 'yyyy-MM-dd')
  const monthDayStr = format(date, 'MM-dd')
  const durationMins = data.service.duration_minutes || 60
  const dayOfWeek = date.getDay() // Use standard JS getDay (0 = Sunday, 1 = Monday, etc.) matching the database rule indexes

  console.log(`Date: ${dateStr}, dow: ${dayOfWeek}, serviceDuration: ${durationMins}m`)
  console.log(`Input data:`, {
    recurringCount: data.recurring.length,
    overridesCount: data.overrides.length,
    allAppointmentsCount: data.appointments.length
  })

  // Check Global Blocked Dates first
  if (data.globalBlockedDates && data.globalBlockedDates.length > 0) {
    const isGloballyBlocked = data.globalBlockedDates.some(b => {
      if (b.type === 'single') return b.date === dateStr
      if (b.type === 'annual') return b.date === monthDayStr
      return false
    })
    if (isGloballyBlocked) {
      const offendingBlocks = data.globalBlockedDates.filter(b => (b.type === 'single' && b.date === dateStr) || (b.type === 'annual' && b.date === monthDayStr))
      console.log('🚨 DIA BLOQUEADO NAS CONFIGURAÇÕES GERAIS:', offendingBlocks)
      console.groupEnd()
      return []
    }
  }

  const dayOverrides = data.overrides.filter(o => o.override_date === dateStr)
  console.log(`dayOverrides matching ${dateStr}:`, dayOverrides)
  
  let isDayAvailable = true
  let timeBlocks: { start_time: string, end_time: string }[] = []

  if (dayOverrides.length > 0) {
    console.log('Found overrides for this day')
    const blockingOverride = dayOverrides.find(o => o.is_available === false && o.start_time === '00:00:00')
    if (blockingOverride) {
      console.log('Found full-day blocking override')
      isDayAvailable = false
    } else {
      const availableOverrides = dayOverrides.filter(o => o.is_available)
      if (availableOverrides.length > 0) {
        timeBlocks = availableOverrides.map(o => ({ start_time: o.start_time, end_time: o.end_time }))
        console.log('Using available override blocks:', timeBlocks)
      } else {
        console.log('Only partial blocking overrides found, mark day unavailable (legacy fallback)')
        isDayAvailable = false
      }
    }
  } else {
    const dailyRules = data.recurring.filter(r => r.day_of_week === dayOfWeek)
    console.log('No overrides. Recurring rules for dow:', dailyRules)
    
    // Check if the rules are compatible with the selected service
    const serviceCompatibleRules = dailyRules.filter(r => !r.service_ids || r.service_ids.length === 0 || r.service_ids.includes(data.service.id))
    console.log('Service compatible rules:', serviceCompatibleRules)

    if (serviceCompatibleRules.length > 0) {
      timeBlocks = serviceCompatibleRules.map(r => ({ start_time: r.start_time, end_time: r.end_time }))
      console.log('Generated time blocks from recurring rules:', timeBlocks)
    } else {
      console.log('No service compatible daily rules found')
      isDayAvailable = false
    }
  }

  if (!isDayAvailable || timeBlocks.length === 0) {
    console.log('Day is NOT available (isDayAvailable=false or no timeBlocks)')
    console.groupEnd()
    return []
  }

  let candidateSlots: Schedule[] = []

  const INTERVAL_MINS = 30 // generates candidate slot options every 30 mins
  console.log(`Generating candidate slots every ${INTERVAL_MINS}m within blocks:`, timeBlocks)

  timeBlocks.forEach(block => {
    let slotStart = parseISO(`${dateStr}T${block.start_time}-03:00`)
    const blockEnd = parseISO(`${dateStr}T${block.end_time}-03:00`)

    while (isBefore(slotStart, blockEnd)) {
      const slotEnd = addMinutes(slotStart, durationMins)
      // Check if full service fits inside block end
      if (isAfter(slotEnd, blockEnd)) {
        console.log(`Slot ${format(slotStart, 'HH:mm')} to ${format(slotEnd, 'HH:mm')} hits boundary blockEnd ${block.end_time}`)
        break
      }

      candidateSlots.push({
        id: `virtual_${format(slotStart, 'HH:mm')}`,
        professional_id: professionalId,
        start_time: slotStart.toISOString(),
        end_time: slotEnd.toISOString(),
        max_capacity: data.service.max_attendees || 1,
        current_count: 0
      })

      // increment by interval, not full duration, to allow appointments to start at any 30min block
      slotStart = addMinutes(slotStart, INTERVAL_MINS)
    }
  })

  console.log(`Generated ${candidateSlots.length} candidate slots`)

  // Filter overlapping appointments
  const dayAppointments = data.appointments.filter(app => {
    if (!app.schedules?.start_time) return false
    const appDate = format(new Date(app.schedules.start_time), 'yyyy-MM-dd')
    return appDate === dateStr && 
           ['scheduled', 'confirmed'].includes(app.status) &&
           app.id !== data.excludeAppointmentId
  })

  console.log(`Day appointments to check overlap:`, dayAppointments.length, dayAppointments)

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
      if (overlapping.length >= slot.max_capacity!) {
        console.log(`Slot ${format(slotStart, 'HH:mm')} removed due to overlap count >= max_capacity (${overlapping.length} / ${slot.max_capacity!})`)
        return false
      }
      return true
    })
  }

  console.log(`Candidate slots after appointment overlap filter: ${candidateSlots.length}`)

  // Business hours filter (07:00 - 22:00)
  const finalSlots = candidateSlots.filter(slot => {
    const timeStr = formatInTimeZone(slot.start_time, TIMEZONE, 'HH:mm')
    const [hours] = timeStr.split(':').map(Number)
    const valid = hours >= 7 && hours < 22
    if (!valid) {
      console.log(`Slot ${timeStr} removed due to out of business hours`)
    }
    return valid
  })

  console.log(`Final slots after business hours filter:`, finalSlots)
  console.groupEnd()
  return finalSlots
}

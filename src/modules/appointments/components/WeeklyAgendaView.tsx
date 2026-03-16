import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  format,
  isToday,
  addMinutes,
  startOfDay,
  parse,
  isBefore,
  isAfter,
  isEqual,
  addHours,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatInTimeZone } from '@/shared/lib/utils'
import {
  Appointment,
  RecurringAvailability,
  AvailabilityOverride,
} from '@/shared/types'
import { getAppointmentsByProfessionalForRange } from '@/shared/services'
import {
  getRecurringAvailability,
  getAvailabilityOverridesForRange,
} from '@/modules/availability/service'
import { ProfessionalAppointmentDialog } from './ProfessionalAppointmentDialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface WeeklyAgendaViewProps {
  professionalId: string
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6) // 06:00 to 21:00

export const WeeklyAgendaView = ({ professionalId }: WeeklyAgendaViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [recurring, setRecurring] = useState<RecurringAvailability[]>([])
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const weekStart = useMemo(
    () => startOfWeek(currentDate, { locale: ptBR }),
    [currentDate],
  )
  const weekEnd = useMemo(
    () => endOfWeek(currentDate, { locale: ptBR }),
    [currentDate],
  )
  const days = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd],
  )

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    const startStr = weekStart.toISOString()
    const endStr = weekEnd.toISOString()

    try {
      const [apptRes, recurringRes, overridesRes] = await Promise.all([
        getAppointmentsByProfessionalForRange(professionalId, startStr, endStr),
        getRecurringAvailability(professionalId),
        getAvailabilityOverridesForRange(professionalId, weekStart, weekEnd),
      ])

      setAppointments(apptRes.data || [])
      setRecurring(recurringRes.data || [])
      setOverrides(overridesRes.data || [])
    } catch (error) {
      console.error('Error fetching weekly agenda:', error)
    } finally {
      setIsLoading(false)
    }
  }, [professionalId, weekStart, weekEnd])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1))
  const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1))
  const goToToday = () => setCurrentDate(new Date())

  const appointmentsMap = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    appointments.forEach((appt) => {
      if (!appt.schedules?.start_time) return
      // Use 30 min granularity key
      const startTime = new Date(appt.schedules.start_time)
      const minutes = startTime.getMinutes() >= 30 ? 30 : 0
      const key = `${formatInTimeZone(appt.schedules.start_time, 'yyyy-MM-dd-HH')}-${minutes}`

      if (!map.has(key)) map.set(key, [])
      map.get(key)?.push(appt)
    })
    return map
  }, [appointments])

  const overridesMap = useMemo(() => {
    const map = new Map<string, AvailabilityOverride[]>()
    overrides.forEach((o) => {
      const key = o.override_date
      if (!map.has(key)) map.set(key, [])
      map.get(key)?.push(o)
    })
    return map
  }, [overrides])

  const recurringMap = useMemo(() => {
    const map = new Map<number, RecurringAvailability[]>()
    recurring.forEach((r) => {
      if (!map.has(r.day_of_week)) map.set(r.day_of_week, [])
      map.get(r.day_of_week)?.push(r)
    })
    return map
  }, [recurring])

  const isSlotAvailable = useCallback(
    (day: Date, hour: number, minutes: number) => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const dayOfWeek = day.getDay()

      // Slot is 30 mins long
      const slotStart = addMinutes(addHours(startOfDay(day), hour), minutes)
      const slotEnd = addMinutes(slotStart, 30)

      const dayOverrides = overridesMap.get(dateStr)

      if (dayOverrides && dayOverrides.length > 0) {
        const isBlocked = dayOverrides.some((o) => {
          if (o.is_available) return false
          const oStart = parse(o.start_time, 'HH:mm:ss', day)
          const oEnd = parse(o.end_time, 'HH:mm:ss', day)
          // Standard overlap check
          return (
            (isBefore(oStart, slotEnd) && isAfter(oEnd, slotStart)) ||
            isEqual(oStart, slotStart)
          )
        })
        if (isBlocked) return false

        const isEnabled = dayOverrides.some((o) => {
          if (!o.is_available) return false
          const oStart = parse(o.start_time, 'HH:mm:ss', day)
          const oEnd = parse(o.end_time, 'HH:mm:ss', day)
          return (
            (isBefore(oStart, slotEnd) && isAfter(oEnd, slotStart)) ||
            isEqual(oStart, slotStart)
          )
        })
        if (isEnabled) return true

        const hasPositiveOverride = dayOverrides.some((o) => o.is_available)
        if (hasPositiveOverride) return false
      }

      const dayRecurring = recurringMap.get(dayOfWeek)
      if (!dayRecurring) return false

      return dayRecurring.some((r) => {
        const rStart = parse(r.start_time, 'HH:mm:ss', day)
        const rEnd = parse(r.end_time, 'HH:mm:ss', day)
        return (
          (isBefore(rStart, slotEnd) && isAfter(rEnd, slotStart)) ||
          isEqual(rStart, slotStart)
        )
      })
    },
    [overridesMap, recurringMap],
  )

  const getAppointmentsForSlot = useCallback(
    (day: Date, hour: number, minutes: number) => {
      const key = `${format(day, 'yyyy-MM-dd')}-${hour.toString().padStart(2, '0')}-${minutes}`
      return appointmentsMap.get(key) || []
    },
    [appointmentsMap],
  )

  const handleAppointmentClick = (appt: Appointment) => {
    setSelectedAppointment(appt)
    setIsDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold capitalize ml-2">
            {format(weekStart, "d 'de' MMM", { locale: ptBR })} -{' '}
            {format(weekEnd, "d 'de' MMM, yyyy", { locale: ptBR })}
          </h2>
        </div>
        <Button variant="outline" onClick={goToToday}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          Hoje
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          ) : (
            <div className="min-w-[800px]">
              <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
                <div className="p-2 border-r bg-muted/30"></div>
                {days.map((day) => (
                  <div
                    key={day.toString()}
                    className={cn(
                      'p-2 text-center border-r last:border-r-0',
                      isToday(day) && 'bg-primary/10',
                    )}
                  >
                    <div className="text-xs text-muted-foreground capitalize">
                      {format(day, 'EEE', { locale: ptBR })}
                    </div>
                    <div
                      className={cn(
                        'text-sm font-bold w-7 h-7 mx-auto flex items-center justify-center rounded-full',
                        isToday(day) && 'bg-primary text-primary-foreground',
                      )}
                    >
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-[60px_repeat(7,1fr)]">
                {HOURS.map((hour) => (
                  <div key={hour} className="contents">
                    {/* Hour Label */}
                    <div className="text-xs text-muted-foreground text-right border-r border-b bg-muted/30 h-[80px]">
                      <div className="p-1 h-[40px] flex items-center justify-end">
                        {`${hour.toString().padStart(2, '0')}:00`}
                      </div>
                      <div className="p-1 h-[40px] flex items-center justify-end text-[10px] opacity-50">
                        :30
                      </div>
                    </div>

                    {days.map((day) => {
                      // Render two 30-min sub-slots
                      return (
                        <div
                          key={`${day}-${hour}`}
                          className="border-r border-b last:border-r-0 h-[80px] flex flex-col"
                        >
                          {[0, 30].map((minutes) => {
                            const isAvailable = isSlotAvailable(
                              day,
                              hour,
                              minutes,
                            )
                            const slotAppointments = getAppointmentsForSlot(
                              day,
                              hour,
                              minutes,
                            )

                            return (
                              <div
                                key={minutes}
                                className={cn(
                                  'h-[40px] w-full relative p-0.5 transition-colors border-b last:border-b-0 border-dashed border-gray-100',
                                  !isAvailable &&
                                    'bg-muted/30 diagonal-stripes',
                                  isAvailable && 'bg-background',
                                )}
                              >
                                {slotAppointments.map((appointment) => {
                                  const hasMissingNotes =
                                    appointment.status === 'completed' &&
                                    (!appointment.notes ||
                                      appointment.notes.length === 0)
                                  return (
                                    <div
                                      key={appointment.id}
                                      onClick={() =>
                                        handleAppointmentClick(appointment)
                                      }
                                      className={cn(
                                        'rounded-sm px-1 py-0.5 text-[10px] cursor-pointer hover:opacity-90 shadow-sm overflow-hidden flex items-center gap-1 shrink-0 relative h-full w-full',
                                        appointment.status === 'completed'
                                          ? 'bg-green-100 text-green-900 border-green-200'
                                          : appointment.status === 'cancelled'
                                            ? 'bg-red-100 text-red-900 border-red-200'
                                            : appointment.status === 'no_show'
                                              ? 'bg-orange-100 text-orange-900 border-orange-200'
                                              : 'bg-primary/20 text-primary-900 border-primary/20 border',
                                      )}
                                    >
                                      {hasMissingNotes && (
                                        <AlertCircle className="h-3 w-3 text-orange-600 shrink-0" />
                                      )}
                                      <span className="font-bold truncate max-w-[50%]">
                                        {appointment.clients.name}
                                      </span>
                                      <span className="truncate opacity-80 flex-1">
                                        {appointment.services.name}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ProfessionalAppointmentDialog
        appointment={selectedAppointment}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onUpdate={fetchData}
      />
    </div>
  )
}

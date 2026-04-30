import { useState, useMemo } from 'react'
import {
  addWeeks,
  subWeeks,
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  isWeekend,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertCircle,
  Maximize2,
  Minimize2,
  PartyPopper,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Appointment } from '@/shared/types'
import { isClinicEvent } from '@/shared/types'
import { cn, formatInTimeZone } from '@/shared/lib/utils'
import { ViewMode } from './AgendaView'
import { computeEventLayout } from '@/shared/lib/event-layout'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAuth } from '@/shared/providers/AuthProvider'
import { useAppointmentsForRange } from '@/modules/appointments/queries'

interface AgendaWeekViewProps {
  currentDate: Date
  onDateChange: (date: Date) => void
  onViewChange: (view: ViewMode) => void
  onAppointmentClick: (appointment: Appointment) => void
  onTimeSlotClick: (date: Date, isSpecificSlot?: boolean) => void
  selectedProfessional: string
  isExpanded: boolean
  refreshTrigger?: number
}

const NORMAL_HEIGHT = 64

export const AgendaWeekView = ({
  currentDate,
  onDateChange,
  onAppointmentClick,
  onTimeSlotClick,
  selectedProfessional,
  isExpanded,
  refreshTrigger,
}: AgendaWeekViewProps) => {
  const { loading, companyId } = useAuth()
  const [hoveredSlot, setHoveredSlot] = useState<{
    day: string
    hour: number
    minutes: number
  } | null>(null)

  const start = useMemo(() => startOfWeek(currentDate, { locale: ptBR, weekStartsOn: 0 }), [currentDate])
  const end = useMemo(() => endOfWeek(currentDate, { locale: ptBR, weekStartsOn: 0 }), [currentDate])

  const { data: appointments = [], isLoading } = useAppointmentsForRange(
    start,
    end,
    selectedProfessional,
    { enabled: !loading && !!companyId },
  )

  const hours = useMemo(() => {
    if (isExpanded) {
      return Array.from({ length: 24 }, (_, i) => i)
    }
    return Array.from({ length: 16 }, (_, i) => i + 6)
  }, [isExpanded])

  const getTopOffset = (time: Date) => {
    const timeStr = formatInTimeZone(time, 'HH:mm')
    const [h, m] = timeStr.split(':').map(Number)

    let effectiveH = h
    if (!isExpanded) {
      if (h < 6) effectiveH = 6 // clamp to top
      if (h > 20) effectiveH = 20 // clamp to bottom
    }

    const startHour = isExpanded ? 0 : 6
    const hoursPassed = Math.max(0, effectiveH - startHour)

    return hoursPassed * NORMAL_HEIGHT + (m / 60) * NORMAL_HEIGHT
  }

  const getDurationHeight = (startTime: Date, durationMinutes: number) => {
    return (durationMinutes / 60) * NORMAL_HEIGHT
  }

  const daysInWeek = useMemo(() => {
    const start = startOfWeek(currentDate, { locale: ptBR, weekStartsOn: 0 })
    const end = endOfWeek(currentDate, { locale: ptBR, weekStartsOn: 0 })
    const allDays = eachDayOfInterval({ start, end })
    return isExpanded ? allDays : allDays.filter((d) => !isWeekend(d))
  }, [currentDate, isExpanded])

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeEventLayout>>()
    const rawMap = new Map<string, Appointment[]>()

    appointments.forEach((appt) => {
      if (!appt.schedules?.start_time) return

      const h = parseInt(formatInTimeZone(appt.schedules.start_time, 'HH'))
      // If collapsed, filter out times outside 06-21 range
      if (!isExpanded && (h < 6 || h >= 22)) {
        return
      }

      const day = formatInTimeZone(appt.schedules.start_time, 'yyyy-MM-dd')
      if (!rawMap.has(day)) rawMap.set(day, [])
      rawMap.get(day)?.push(appt)
    })

    rawMap.forEach((appts, day) => {
      map.set(day, computeEventLayout(appts, getTopOffset, getDurationHeight))
    })

    return map
  }, [appointments, isExpanded])

  const nextWeek = () => onDateChange(addWeeks(currentDate, 1))
  const prevWeek = () => onDateChange(subWeeks(currentDate, 1))

  const handleMouseMove = (e: React.MouseEvent, day: Date) => {
    const rect = e.currentTarget.getBoundingClientRect()
    let y = e.clientY - rect.top

    // Clamp to ensure we don't go out of bounds
    if (y < 0) y = 0
    if (y >= rect.height) y = rect.height - 1

    const startHour = isExpanded ? 0 : 6
    const hourIndex = Math.floor(y / NORMAL_HEIGHT)
    const currentHour = startHour + hourIndex

    const maxHour = isExpanded ? 23 : 21
    if (currentHour > maxHour) {
      setHoveredSlot(null)
      return
    }

    const relativeY = y % NORMAL_HEIGHT
    const minutes = relativeY < NORMAL_HEIGHT / 2 ? 0 : 30
    const dayKey = format(day, 'yyyy-MM-dd')

    if (
      hoveredSlot?.day !== dayKey ||
      hoveredSlot?.hour !== currentHour ||
      hoveredSlot?.minutes !== minutes
    ) {
      setHoveredSlot({ day: dayKey, hour: currentHour, minutes: minutes })
    }
  }

  const handleMouseLeave = () => {
    setHoveredSlot(null)
  }

  return (
    <div className="flex flex-col bg-background">
      <div className="sticky top-14 z-40 bg-background border-b p-4 flex justify-between items-center shrink-0 shadow-sm">
        <div className="flex items-center justify-center w-full gap-2">
          <Button variant="outline" size="icon" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold capitalize text-center w-[200px]">
            {format(
              startOfWeek(currentDate, { locale: ptBR, weekStartsOn: 0 }),
              'dd MMM',
            )}{' '}
            -{' '}
            {format(
              endOfWeek(currentDate, { locale: ptBR, weekStartsOn: 0 }),
              'dd MMM',
              {
                locale: ptBR,
              },
            )}
          </h2>
          <Button variant="outline" size="icon" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-4">
          <Skeleton className="h-[600px] w-full" />
        </div>
      ) : (
        <div className="relative border-l border-r border-b">
          {/* Scrollable Container for Mobile */}
          <div className="overflow-x-auto snap-x snap-mandatory custom-scrollbar">
            <div className="min-w-max relative">
              <div className="sticky top-[7rem] z-30 flex border-b bg-background">
                <div className="w-12 shrink-0 border-r bg-muted/30 sticky left-0 z-40 bg-background"></div>
                {daysInWeek.map((day) => (
                  <div
                    key={day.toString()}
                    className={cn(
                      'flex-1 min-w-[140px] text-center py-2 border-r last:border-0 snap-start',
                      isToday(day) && 'bg-primary/5',
                    )}
                  >
                  <p className="text-xs uppercase text-muted-foreground">
                    {format(day, 'EEE', { locale: ptBR })}
                  </p>
                  <p
                    className={cn(
                      'text-lg font-bold w-8 h-8 mx-auto flex items-center justify-center rounded-full',
                      isToday(day) && 'bg-primary text-primary-foreground',
                    )}
                  >
                    {format(day, 'd')}
                  </p>
                </div>
              ))}
              </div>
            </div>

            <div className="flex relative">
              <div className="w-12 shrink-0 border-r bg-muted/10 sticky left-0 z-40 bg-background">
                {hours.map((h) => (
                  <div
                    key={h}
                    style={{ height: NORMAL_HEIGHT }}
                    className="border-b text-xs text-muted-foreground flex items-center justify-center relative font-medium"
                  >
                    {h}:00
                  </div>
                ))}
              </div>

              {daysInWeek.map((day) => {
                const dayKey = format(day, 'yyyy-MM-dd')
                const dayAppts = appointmentsByDay.get(dayKey) || []

                return (
                  <div
                    key={day.toString()}
                    className="flex-1 min-w-[140px] border-r last:border-0 relative bg-background cursor-pointer group snap-start"
                    onMouseMove={(e) => handleMouseMove(e, day)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => {
                      if (hoveredSlot?.day === dayKey) {
                        const targetTime = new Date(day)
                        targetTime.setHours(
                          hoveredSlot.hour,
                          hoveredSlot.minutes,
                          0,
                          0,
                        )
                        onTimeSlotClick(targetTime, true)
                      }
                    }}
                  >
                    <div className="absolute inset-0 flex flex-col pointer-events-none z-0">
                      {hours.map((h) => (
                        <div
                          key={h}
                          style={{ height: NORMAL_HEIGHT }}
                          className="border-b relative"
                        >
                          <div className="absolute top-1/2 left-0 right-0 border-b border-dashed border-gray-100/50" />
                        </div>
                      ))}
                    </div>

                    {dayAppts.map((appt) => {
                      const { top, height, left, width } = appt.layout
                      const adjustedWidth =
                        width === 100 ? 'calc(100% - 10px)' : `${width}%`
                      const isEvent = isClinicEvent(appt)
                      const hasMissingNotes =
                        !isEvent &&
                        appt.status === 'completed' &&
                        appt.services?.requires_observation !== false &&
                        (!appt.notes || appt.notes.length === 0)

                      // Linha principal: nome do cliente ou título do evento
                      const primaryLabel = isEvent
                        ? (appt.event_title || 'Evento')
                        : (appt.clients?.name || '')

                      // Linha secundária: nome do serviço ou contratante do evento
                      const secondaryLabel = isEvent
                        ? (appt.event_contractor || '—')
                        : (appt.services?.name || '')

                      return (
                        <div
                          key={appt.id}
                          style={{
                            top: top,
                            height: height,
                            left: `${left}%`,
                            width: adjustedWidth,
                            position: 'absolute',
                            padding: '1px',
                          }}
                          className="z-10"
                        >
                          <div
                            className={cn(
                              'h-full w-full rounded p-1 text-xs cursor-pointer shadow-sm overflow-hidden border transition-transform hover:scale-[1.02] hover:z-20 relative',
                              isEvent
                                ? 'bg-purple-100 text-purple-900 border-purple-300'
                                : appt.status === 'completed'
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : appt.status === 'cancelled'
                                    ? 'bg-red-100 text-red-800 border-red-200'
                                    : appt.status === 'no_show'
                                      ? 'bg-orange-100 text-orange-800 border-orange-200'
                                      : 'bg-primary/10 text-primary border-primary/20',
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              onAppointmentClick(appt)
                            }}
                            title={isEvent ? appt.event_title : `${appt.clients?.name} - ${appt.services?.name}`}
                          >
                            <div className="absolute top-0.5 right-0.5 z-30 flex items-center gap-0.5">
                              {isEvent && (
                                <PartyPopper className="h-3 w-3 text-purple-500" />
                              )}
                              {hasMissingNotes && (
                                <AlertCircle className="h-3 w-3 text-red-600" />
                              )}
                            </div>
                            <div className="font-semibold truncate leading-none mb-0.5">
                              {primaryLabel}
                            </div>
                            <div className="truncate text-[10px] font-medium leading-none mb-0.5">
                              {secondaryLabel}
                            </div>
                            <div className="truncate text-[10px] opacity-80 leading-none">
                              {formatInTimeZone(
                                appt.schedules.start_time,
                                'HH:mm',
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {hoveredSlot?.day === dayKey && (
                      <div
                        className="absolute w-full z-20 pointer-events-none"
                        style={{
                          top: 0,
                          height: '100%',
                        }}
                      >
                        {(() => {
                          const startHour = isExpanded ? 0 : 6
                          const h = hoveredSlot.hour
                          const offsetRows = h - startHour
                          let offset = offsetRows * NORMAL_HEIGHT
                          if (hoveredSlot.minutes === 30) {
                            offset += NORMAL_HEIGHT / 2
                          }

                          return (
                            <div
                              style={{
                                top: offset,
                                height: NORMAL_HEIGHT / 2,
                              }}
                              className="absolute w-full flex items-center justify-center bg-primary/5 border-t border-b border-primary/20 pointer-events-none"
                            >
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-6 w-6 rounded-full pointer-events-auto shadow-sm animate-in fade-in zoom-in duration-100 scale-90 hover:scale-100"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const targetTime = new Date(day)
                                  targetTime.setHours(
                                    h,
                                    hoveredSlot.minutes,
                                    0,
                                    0,
                                  )
                                  onTimeSlotClick(targetTime, true)
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

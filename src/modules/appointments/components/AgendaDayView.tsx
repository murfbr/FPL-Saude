import { useState, useEffect, useMemo } from 'react'
import { addDays, subDays, format, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getAppointmentsForRange } from '@/shared/services'
import { Appointment } from '@/shared/types'
import { cn, formatInTimeZone } from '@/shared/lib/utils'
import { ViewMode } from './AgendaView'
import { computeEventLayout } from '@/shared/lib/event-layout'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface AgendaDayViewProps {
  currentDate: Date
  onDateChange: (date: Date) => void
  onViewChange: (view: ViewMode) => void
  onAppointmentClick: (appointment: Appointment) => void
  onTimeSlotClick: (date: Date, isSpecificSlot?: boolean) => void
  selectedProfessional: string
  isExpanded: boolean
}

const NORMAL_HEIGHT = 64

export const AgendaDayView = ({
  currentDate,
  onDateChange,
  onAppointmentClick,
  onTimeSlotClick,
  selectedProfessional,
  isExpanded,
}: AgendaDayViewProps) => {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hoveredSlot, setHoveredSlot] = useState<{
    hour: number
    minutes: number
  } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const start = startOfDay(currentDate)
      const end = endOfDay(currentDate)
      const { data } = await getAppointmentsForRange(
        start,
        end,
        selectedProfessional,
      )
      setAppointments(data || [])
      setIsLoading(false)
    }
    fetchData()
  }, [selectedProfessional, currentDate])

  // If Expanded: Show 00-23
  // If Collapsed: Show 06-20 (covers until 21:00)
  // Hidden: 00-05 and 21-23
  const hours = useMemo(() => {
    if (isExpanded) {
      return Array.from({ length: 24 }, (_, i) => i)
    }
    return Array.from({ length: 15 }, (_, i) => i + 6) // 06:00 to 20:59
  }, [isExpanded])

  const getTopOffset = (time: Date) => {
    const timeStr = formatInTimeZone(time, 'HH:mm')
    const [h, m] = timeStr.split(':').map(Number)

    let effectiveH = h
    if (!isExpanded) {
      if (h < 6) effectiveH = 6
      if (h > 20) effectiveH = 20
    }

    const startHour = isExpanded ? 0 : 6
    const hoursPassed = Math.max(0, effectiveH - startHour)

    return hoursPassed * NORMAL_HEIGHT + (m / 60) * NORMAL_HEIGHT
  }

  const getDurationHeight = (startTime: Date, durationMinutes: number) => {
    return (durationMinutes / 60) * NORMAL_HEIGHT
  }

  const dayAppointments = useMemo(() => {
    const filtered = appointments.filter((appt) => {
      if (!appt.schedules?.start_time) return false
      // Filter collapsed hours
      const h = parseInt(formatInTimeZone(appt.schedules.start_time, 'HH'))
      if (!isExpanded && (h < 6 || h >= 21)) return false

      return (
        formatInTimeZone(appt.schedules.start_time, 'yyyy-MM-dd') ===
        format(currentDate, 'yyyy-MM-dd')
      )
    })

    return computeEventLayout(filtered, getTopOffset, getDurationHeight)
  }, [appointments, currentDate, isExpanded])

  const nextDay = () => onDateChange(addDays(currentDate, 1))
  const prevDay = () => onDateChange(subDays(currentDate, 1))

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    let y = e.clientY - rect.top

    // Clamp to ensure we don't go out of bounds
    if (y < 0) y = 0
    if (y >= rect.height) y = rect.height - 1

    const startHour = isExpanded ? 0 : 6
    const hourIndex = Math.floor(y / NORMAL_HEIGHT)
    const currentHour = startHour + hourIndex

    const maxHour = isExpanded ? 23 : 20
    if (currentHour > maxHour) {
      setHoveredSlot(null)
      return
    }

    const relativeY = y % NORMAL_HEIGHT
    const minutes = relativeY < NORMAL_HEIGHT / 2 ? 0 : 30

    if (hoveredSlot?.hour !== currentHour || hoveredSlot?.minutes !== minutes) {
      setHoveredSlot({ hour: currentHour, minutes })
    }
  }

  const handleMouseLeave = () => {
    setHoveredSlot(null)
  }

  return (
    <div className="flex flex-col bg-background">
      <div className="sticky top-14 z-40 bg-background border-b p-4 flex justify-between items-center shrink-0 shadow-sm">
        <div className="flex items-center justify-center w-full gap-2">
          <Button variant="outline" size="icon" onClick={prevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg md:text-xl font-semibold capitalize min-w-[200px] text-center">
            {format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </h2>
          <Button variant="outline" size="icon" onClick={nextDay}>
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
          <div className="flex relative min-h-full">
            {/* Time Column - Centered Alignment */}
            <div className="w-12 shrink-0 border-r bg-muted/30 sticky left-0 z-40 bg-background">
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

            {/* Day Column */}
            <div
              className="flex-1 relative bg-background cursor-pointer"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={() => {
                if (hoveredSlot !== null) {
                  const targetTime = new Date(currentDate)
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
              {/* 1. Background Grid Lines */}
              <div className="absolute inset-0 flex flex-col pointer-events-none z-0">
                {hours.map((h) => (
                  <div
                    key={h}
                    style={{ height: NORMAL_HEIGHT }}
                    className="border-b border-dashed relative"
                  >
                    {/* 30-min subtle line */}
                    <div className="absolute top-1/2 left-0 right-0 border-b border-dashed border-gray-100/50" />
                  </div>
                ))}
              </div>

              {/* 2. Appointments */}
              {dayAppointments.map((appt) => {
                const { top, height, left, width } = appt.layout
                const adjustedWidth =
                  width === 100 ? 'calc(100% - 12px)' : `${width}%`
                const hasMissingNotes =
                  appt.status === 'completed' &&
                  (!appt.notes || appt.notes.length === 0)

                return (
                  <div
                    key={appt.id}
                    style={{
                      top: top,
                      height: height,
                      left: `${left}%`,
                      width: adjustedWidth,
                      position: 'absolute',
                      padding: '2px',
                    }}
                    className="z-10"
                  >
                    <div
                      className={cn(
                        'h-full w-full rounded-md p-2 text-sm cursor-pointer shadow-sm overflow-hidden border transition-all hover:brightness-95 hover:z-20 relative',
                        appt.status === 'completed'
                          ? 'bg-green-100 text-green-900 border-green-200'
                          : appt.status === 'cancelled'
                            ? 'bg-red-100 text-red-900 border-red-200'
                            : appt.status === 'no_show'
                              ? 'bg-orange-100 text-orange-900 border-orange-200'
                              : 'bg-primary/10 text-primary border-primary/20',
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        onAppointmentClick(appt)
                      }}
                    >
                      {hasMissingNotes && (
                        <div className="absolute top-1 right-1">
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertCircle className="h-4 w-4 text-orange-600" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Notas pendentes</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                      <div className="flex flex-col h-full">
                        <div className="flex justify-between items-start font-bold pr-4">
                          <span className="truncate">{appt.clients.name}</span>
                          <span className="font-mono text-xs opacity-75 shrink-0 ml-1">
                            {formatInTimeZone(
                              appt.schedules.start_time,
                              'HH:mm',
                            )}
                          </span>
                        </div>
                        <div className="text-xs opacity-90 truncate mt-0.5">
                          {appt.services.name}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* 3. Interaction Layer (Plus Buttons) */}
              {hoveredSlot !== null && (
                <div
                  className="absolute w-full z-20 pointer-events-none"
                  style={{ top: 0, height: '100%' }}
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
                        className="absolute w-full flex items-center justify-center bg-black/5 pointer-events-none"
                      >
                        <Button
                          variant="secondary"
                          className="rounded-full shadow-sm pointer-events-auto animate-in fade-in zoom-in duration-100 h-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            const targetTime = new Date(currentDate)
                            targetTime.setHours(h, hoveredSlot.minutes, 0, 0)
                            onTimeSlotClick(targetTime, true)
                          }}
                        >
                          <Plus className="h-3 w-3 mr-2" />
                          Agendar às {h}:
                          {hoveredSlot.minutes === 0 ? '00' : '30'}
                        </Button>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

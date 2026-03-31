import { useState, useEffect, useMemo } from 'react'
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  getDay,
  isValid,
  isWeekend,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getAppointmentsForRange } from '@/shared/services'
import { Appointment } from '@/shared/types'
import { cn, formatInTimeZone } from '@/shared/lib/utils'
import { ViewMode } from './AgendaView'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface AgendaCalendarViewProps {
  currentDate: Date
  onDateChange: (date: Date) => void
  onViewChange: (view: ViewMode) => void
  onAppointmentClick: (appointment: Appointment) => void
  onTimeSlotClick: (date: Date, isSpecificSlot?: boolean) => void
  selectedProfessional: string
  isExpanded: boolean
}

export const AgendaCalendarView = ({
  currentDate,
  onDateChange,
  onViewChange,
  onAppointmentClick,
  onTimeSlotClick,
  selectedProfessional,
  isExpanded,
}: AgendaCalendarViewProps) => {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [displayedMonth, setDisplayedMonth] = useState(currentDate)

  useEffect(() => {
    setDisplayedMonth(currentDate)
  }, [currentDate])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const start = startOfMonth(displayedMonth)
      const end = endOfMonth(displayedMonth)

      const { data } = await getAppointmentsForRange(
        start,
        end,
        selectedProfessional,
      )
      setAppointments(data || [])
      setIsLoading(false)
    }
    fetchData()
  }, [displayedMonth, selectedProfessional])

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(displayedMonth)
    const end = endOfMonth(displayedMonth)
    const allDays = eachDayOfInterval({ start, end })
    return isExpanded ? allDays : allDays.filter((d) => !isWeekend(d))
  }, [displayedMonth, isExpanded])

  // For full 7-day grid, use getDay (0=Sun). For 5-day grid, compute the weekday offset (Mon=0)
  const startingDayIndex = useMemo(() => {
    if (isExpanded) {
      return getDay(startOfMonth(displayedMonth))
    }
    // When hiding weekends, the grid is Mon-Fri (5 cols)
    // getDay returns 0=Sun,1=Mon,...,6=Sat
    const dayOfWeek = getDay(startOfMonth(displayedMonth))
    // Map: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4. If month starts on Sat/Sun, offset is 0
    if (dayOfWeek === 0 || dayOfWeek === 6) return 0
    return dayOfWeek - 1
  }, [displayedMonth, isExpanded])

  const dayHeaders = isExpanded
    ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']

  const gridCols = isExpanded ? 'grid-cols-7' : 'grid-cols-5'

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    appointments
      .filter(
        (appt) =>
          appt.schedules?.start_time &&
          isValid(new Date(appt.schedules.start_time)),
      )
      .forEach((appt) => {
        const day = formatInTimeZone(appt.schedules.start_time, 'yyyy-MM-dd')
        if (!map.has(day)) {
          map.set(day, [])
        }
        map.get(day)?.push(appt)
      })
    return map
  }, [appointments])

  const nextMonth = () => setDisplayedMonth(addMonths(displayedMonth, 1))
  const prevMonth = () => setDisplayedMonth(subMonths(displayedMonth, 1))

  const handleDateClick = (day: Date) => {
    onDateChange(day)
    onViewChange('day')
  }

  const handlePlusClick = (e: React.MouseEvent, day: Date) => {
    e.stopPropagation()
    const dateWithTime = new Date(day)
    dateWithTime.setHours(0, 0, 0, 0)
    onTimeSlotClick(dateWithTime, false)
  }

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg md:text-xl font-semibold capitalize text-center">
          {format(displayedMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-[600px] w-full" />
      ) : (
        <div className="overflow-x-auto snap-x snap-mandatory custom-scrollbar pb-2">
          <div className={cn('grid gap-px bg-border min-w-[800px] snap-center', gridCols)}>
            {dayHeaders.map((day, i) => (
              <div
                key={i}
                className="text-center font-medium py-2 bg-card text-xs sm:text-sm"
              >
                {day}
              </div>
            ))}
            {Array.from({ length: startingDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-muted/50" />
            ))}
            {daysInMonth.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd')
              const dayAppointments = appointmentsByDay.get(dayKey) || []
              return (
                <div
                  key={day.toString()}
                  className={cn(
                    'p-1 sm:p-2 min-h-[80px] sm:min-h-[120px] bg-card relative group hover:bg-muted/10 transition-colors cursor-pointer',
                    !isSameMonth(day, displayedMonth) && 'bg-muted/50',
                  )}
                  onClick={() => handleDateClick(day)}
                >
                  <div className="flex justify-between items-start">
                    <time
                      dateTime={format(day, 'yyyy-MM-dd')}
                      className={cn(
                        'block text-xs sm:text-sm text-center h-6 w-6 rounded-full leading-6',
                        isToday(day) && 'bg-primary text-primary-foreground',
                      )}
                    >
                      {format(day, 'd')}
                    </time>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handlePlusClick(e, day)}
                      title="Novo agendamento"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-1 space-y-1 hidden sm:block">
                    {dayAppointments.slice(0, 3).map((appt) => {
                      const hasMissingNotes =
                        appt.status === 'completed' &&
                        appt.services?.requires_observation !== false &&
                        (!appt.notes || appt.notes.length === 0)

                      return (
                        <div
                          key={appt.id}
                          className="text-[10px] p-1 bg-secondary text-secondary-foreground rounded truncate cursor-pointer hover:opacity-80 flex items-center justify-between"
                          onClick={(e) => {
                            e.stopPropagation()
                            onAppointmentClick(appt)
                          }}
                          title={`${appt.clients.name} - ${appt.services.name}`}
                        >
                          <span className="truncate">{appt.clients.name}</span>
                          {hasMissingNotes && (
                            <AlertCircle className="h-3 w-3 text-red-600 shrink-0 ml-1" />
                          )}
                        </div>
                      )
                    })}
                    {dayAppointments.length > 3 && (
                      <div className="text-[10px] text-muted-foreground pl-1">
                        + {dayAppointments.length - 3} mais
                      </div>
                    )}
                  </div>
                  {dayAppointments.length > 0 && (
                    <div className="sm:hidden w-2 h-2 rounded-full bg-primary mx-auto mt-1"></div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

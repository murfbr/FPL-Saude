import { useState, useEffect, useMemo, useCallback } from 'react'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getAppointmentsByProfessionalForRange } from '@/services'
import { getAvailabilityOverrides } from '@/services/availability'
import { Appointment, AvailabilityOverride } from '@/types'
import {
  format,
  startOfMonth,
  endOfMonth,
  isSameDay,
  parseISO,
  isValid,
} from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { ProfessionalAppointmentDialog } from './ProfessionalAppointmentDialog'
import { DayProps } from 'react-day-picker'
import { formatInTimeZone } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface MonthlyAgendaViewProps {
  professionalId: string
  onDateSelect: (date: Date) => void
}

export const MonthlyAgendaView = ({
  professionalId,
  onDateSelect,
}: MonthlyAgendaViewProps) => {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const fetchMonthData = useCallback(async () => {
    setIsLoading(true)
    const startDate = startOfMonth(currentMonth)
    const endDate = endOfMonth(currentMonth)
    const [apptRes, overrideRes] = await Promise.all([
      getAppointmentsByProfessionalForRange(
        professionalId,
        startDate.toISOString(),
        endDate.toISOString(),
      ),
      getAvailabilityOverrides(professionalId, currentMonth),
    ])
    setAppointments(apptRes.data || [])
    setOverrides(overrideRes.data || [])
    setIsLoading(false)
  }, [professionalId, currentMonth])

  useEffect(() => {
    fetchMonthData()
  }, [fetchMonthData])

  const validAppointments = useMemo(
    () =>
      appointments.filter(
        (appt) =>
          appt.schedules?.start_time &&
          isValid(new Date(appt.schedules.start_time)),
      ),
    [appointments],
  )

  const appointmentsByDay = useMemo(() => {
    const counts = new Map<string, number>()
    validAppointments.forEach((appt) => {
      const day = formatInTimeZone(appt.schedules.start_time, 'yyyy-MM-dd')
      counts.set(day, (counts.get(day) || 0) + 1)
    })
    return counts
  }, [validAppointments])

  const CustomDay = (props: DayProps) => {
    if (!props.date || !isValid(props.date)) {
      return <CalendarDayButton {...props} />
    }
    const dayKey = format(props.date, 'yyyy-MM-dd')
    const count = appointmentsByDay.get(dayKey)
    return (
      <div className="relative">
        <CalendarDayButton {...props} />
        {count && count > 0 && (
          <div className="absolute bottom-0 right-0 text-xs bg-primary text-primary-foreground rounded-full h-4 w-4 flex items-center justify-center pointer-events-none">
            {count}
          </div>
        )}
      </div>
    )
  }

  const { appointmentsOnSelectedDay, isSelectedDayBlocked } = useMemo(() => {
    if (!date)
      return { appointmentsOnSelectedDay: [], isSelectedDayBlocked: false }
    const selectedDayStr = format(date, 'yyyy-MM-dd')
    const dayOverride = overrides.find(
      (o) => o.override_date === selectedDayStr && !o.is_available,
    )
    return {
      appointmentsOnSelectedDay: validAppointments.filter((appt) => {
        const apptDay = formatInTimeZone(
          appt.schedules.start_time,
          'yyyy-MM-dd',
        )
        return apptDay === selectedDayStr
      }),
      isSelectedDayBlocked: !!dayOverride,
    }
  }, [validAppointments, overrides, date])

  const blockedDays = useMemo(() => {
    return overrides
      .filter((o) => {
        const overrideDate = parseISO(o.override_date)
        return !o.is_available && isValid(overrideDate)
      })
      .map((o) => parseISO(o.override_date))
  }, [overrides])

  const handleAppointmentClick = (appt: Appointment) => {
    setSelectedAppointment(appt)
    setIsDialogOpen(true)
  }

  return (
    <>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <Calendar
              mode="single"
              selected={date}
              onSelect={(selectedDate) => {
                if (selectedDate) {
                  setDate(selectedDate)
                  onDateSelect(selectedDate)
                }
              }}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              className="rounded-md border p-3"
              disabled={blockedDays}
              modifiersStyles={{
                disabled: {
                  color: 'hsl(var(--destructive))',
                  textDecoration: 'line-through',
                },
              }}
              components={{ Day: CustomDay }}
            />
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              Detalhes para {date ? format(date, 'dd/MM/yyyy') : '...'}
            </CardTitle>
            <CardDescription>
              {appointmentsOnSelectedDay.length} agendamento(s) encontrado(s).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {appointmentsOnSelectedDay.length > 0 ? (
              appointmentsOnSelectedDay.map((appt) => {
                const hasMissingNotes =
                  appt.status === 'completed' &&
                  (!appt.notes || appt.notes.length === 0)
                return (
                  <div
                    key={appt.id}
                    className="p-3 border rounded-md flex justify-between items-center cursor-pointer hover:bg-muted/50"
                    onClick={() => handleAppointmentClick(appt)}
                  >
                    <div className="flex-1">
                      <p className="font-semibold">{appt.clients.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">
                          {appt.services.name}
                        </p>
                        {hasMissingNotes && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertCircle className="h-4 w-4 text-orange-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Notas pendentes</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {formatInTimeZone(appt.schedules.start_time, 'HH:mm')}
                    </Badge>
                  </div>
                )
              })
            ) : (
              <p className="text-center text-muted-foreground pt-8">
                Nenhum agendamento para o dia selecionado.
              </p>
            )}
          </CardContent>
          {date && isSelectedDayBlocked && (
            <CardFooter className="border-t pt-4">
              <p className="text-sm text-destructive font-medium">
                Este dia está marcado como indisponível.
              </p>
            </CardFooter>
          )}
        </Card>
      </div>
      <ProfessionalAppointmentDialog
        appointment={selectedAppointment}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onUpdate={fetchMonthData}
      />
    </>
  )
}

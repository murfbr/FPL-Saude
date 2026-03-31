import { useState, useEffect } from 'react'
import { format, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { getAppointmentsByProfessionalForRange } from '@/shared/services'
import { Appointment } from '@/shared/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, AlertCircle } from 'lucide-react'
import { ProfessionalAppointmentDialog } from './ProfessionalAppointmentDialog'
import { formatInTimeZone } from '@/shared/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface DailyAgendaViewProps {
  professionalId: string
  date: Date
}

export const DailyAgendaView = ({
  professionalId,
  date,
}: DailyAgendaViewProps) => {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const fetchData = async () => {
    setIsLoading(true)
    const startDate = new Date(date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)

    const { data } = await getAppointmentsByProfessionalForRange(
      professionalId,
      startDate.toISOString(),
      endDate.toISOString(),
    )
    setAppointments(data || [])
    setIsLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [professionalId, date])

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setIsDialogOpen(true)
  }

  const validAppointments = appointments.filter(
    (appt) =>
      appt.schedules?.start_time &&
      isValid(new Date(appt.schedules.start_time)),
  )

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="capitalize">
            {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : validAppointments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum agendamento para este dia.
            </p>
          ) : (
            <ul className="space-y-3">
              {validAppointments
                .sort(
                  (a, b) =>
                    new Date(a.schedules.start_time).getTime() -
                    new Date(b.schedules.start_time).getTime(),
                )
                .map((appt) => {
                  const hasMissingNotes =
                    appt.status === 'completed' &&
                    appt.services?.requires_observation !== false &&
                    (!appt.notes || appt.notes.length === 0)
                  return (
                    <li
                      key={appt.id}
                      className="p-4 border rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleAppointmentClick(appt)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-lg">
                            {appt.clients.name}
                          </p>
                          <Badge variant="outline">{appt.status}</Badge>
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
                        <p className="text-sm text-muted-foreground">
                          {appt.services.name} •{' '}
                          {formatInTimeZone(appt.schedules.start_time, 'HH:mm')}{' '}
                          - {formatInTimeZone(appt.schedules.end_time, 'HH:mm')}
                        </p>
                        {appt.notes && appt.notes.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-2 bg-muted p-2 rounded">
                            <p className="font-semibold mb-1">
                              Última anotação:
                            </p>
                            <p className="line-clamp-2">
                              {appt.notes[appt.notes.length - 1].content}
                            </p>
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Detalhes
                      </Button>
                    </li>
                  )
                })}
            </ul>
          )}
        </CardContent>
      </Card>

      <ProfessionalAppointmentDialog
        appointment={selectedAppointment}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onUpdate={fetchData}
      />
    </>
  )
}

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Appointment } from '@/shared/types'
import { format, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface UpcomingAppointmentsProps {
  appointments: Appointment[]
}

export const UpcomingAppointments = ({
  appointments,
}: UpcomingAppointmentsProps) => {
  const validAppointments = appointments.filter(
    (appt) =>
      appt.schedules?.start_time &&
      isValid(new Date(appt.schedules.start_time)),
  )

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Serviço</TableHead>
          <TableHead>Horário</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {validAppointments.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center">
              Nenhum agendamento encontrado.
            </TableCell>
          </TableRow>
        ) : (
          validAppointments.map((appt) => (
            <TableRow key={appt.id}>
              <TableCell>
                <div className="font-medium">
                  {appt.clients?.name || 'Cliente não informado'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {appt.clients?.email || ''}
                </div>
              </TableCell>
              <TableCell>
                {appt.services?.name || 'Serviço não informado'}
              </TableCell>
              <TableCell>
                {format(
                  new Date(appt.schedules.start_time),
                  "dd/MM/yyyy 'às' HH:mm",
                  { locale: ptBR },
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{appt.status}</Badge>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

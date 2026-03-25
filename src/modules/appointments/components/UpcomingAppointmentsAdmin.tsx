import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getUpcomingAppointments } from '@/shared/services'
import { Appointment } from '@/shared/types'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarClock } from 'lucide-react'

export const UpcomingAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAppointments = async () => {
      setIsLoading(true)
      const { data } = await getUpcomingAppointments()
      setAppointments(data || [])
      setIsLoading(false)
    }
    fetchAppointments()
  }, [])

  const validAppointments = appointments.filter(
    (appt) => appt.schedules?.start_time,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5" />
          Próximos Agendamentos
        </CardTitle>
        <CardDescription>
          Os 5 próximos agendamentos da clínica.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : validAppointments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum agendamento futuro encontrado.
          </p>
        ) : (
          <ul className="space-y-3">
            {validAppointments.map((appt) => (
              <li key={appt.id} className="flex items-center justify-between">
                <div className="font-medium">
                  <Link
                    to={`/admin/pacientes/${appt.client_id}`}
                    className="hover:underline text-primary"
                  >
                    {appt.clients?.name || 'Cliente não informado'}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    com{' '}
                    {appt.professionals?.name || 'Profissional não informado'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {format(new Date(appt.schedules.start_time), 'HH:mm')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(appt.schedules.start_time), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

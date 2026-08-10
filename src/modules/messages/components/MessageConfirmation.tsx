import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { MessageSquare, ExternalLink } from 'lucide-react'
import { getAppointmentsForRange } from '@/shared/services'
import { Appointment } from '@/shared/types'
import { format, addHours, isToday, isTomorrow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const MessageConfirmation = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAppointments = async () => {
      setIsLoading(true)
      const now = new Date()
      const in24Hours = addHours(now, 24)
      
      const { data } = await getAppointmentsForRange(now, in24Hours)
      
      // Filter out cancelled appointments and sort by time
      const filtered = (data || [])
        .filter(appt => appt.status !== 'cancelled' && appt.schedules?.start_time)
        .sort((a, b) => 
          new Date(a.schedules.start_time).getTime() - new Date(b.schedules.start_time).getTime()
        )
      
      setAppointments(filtered)
      setIsLoading(false)
    }
    fetchAppointments()
  }, [])

  const generateWhatsAppLink = (appt: Appointment) => {
    const clientName = appt.clients?.name || 'Cliente'
    const serviceName = appt.services?.name || 'atendimento'
    const startTime = parseISO(appt.schedules.start_time)
    const timeStr = format(startTime, 'HH:mm')
    const dateStr = format(startTime, 'dd/MM')
    
    let dayRef = ''
    if (isToday(startTime)) {
      dayRef = 'Hoje'
    } else if (isTomorrow(startTime)) {
      dayRef = 'Amanhã'
    } else {
      dayRef = `dia ${dateStr}`
    }

    const message = `Olá *${clientName}*, tudo bem? Confirmado nosso atendimento de *${serviceName}, ${dayRef}, dia ${dateStr} às ${timeStr}*?`

    
    // Normalize phone number:
    // 1. Remove all non-digits
    const rawDigits = (appt.clients?.phone || '').replace(/\D/g, '')
    
    // 2. Remove leading '55' (country) and '0' (trunk) if present
    const cleanDigits = rawDigits.replace(/^55/, '').replace(/^0/, '')
    
    // 3. Build final phone with exactly one '55'
    const finalPhone = `55${cleanDigits}`

    const encodedMessage = encodeURIComponent(message)
    return `https://wa.me/${finalPhone}?text=${encodedMessage}`
  }



  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Confirmação de Consultas
        </CardTitle>
        <CardDescription>
          Clientes com consultas marcadas nas próximas 24 horas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum agendamento nas próximas 24 horas para confirmação.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-semibold">Hora</th>
                  <th className="pb-2 font-semibold">Paciente</th>
                  <th className="pb-2 font-semibold">Serviço</th>
                  <th className="pb-2 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {appointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-accent/50 transition-colors">
                    <td className="py-3">
                      <span className="font-medium">
                        {format(parseISO(appt.schedules.start_time), 'HH:mm')}
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        {isToday(parseISO(appt.schedules.start_time)) ? 'Hoje' : 'Amanhã'}
                      </p>
                    </td>
                    <td className="py-3">
                      <div className="font-medium">{appt.clients?.name}</div>
                      {appt.clients?.phone && (
                        <p className="text-xs text-muted-foreground">{appt.clients.phone}</p>
                      )}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-[10px]">
                        {appt.services?.name}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {appt.clients?.phone ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          asChild
                        >
                          <a 
                            href={generateWhatsAppLink(appt)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <MessageSquare className="w-4 h-4 text-green-600" />
                            Enviar
                            <ExternalLink className="w-3 h-3 opacity-50" />
                          </a>
                        </Button>
                      ) : (
                        <span className="text-[10px] text-destructive font-medium border border-destructive/20 bg-destructive/5 px-2 py-1 rounded">
                          Sem Telefone
                        </span>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

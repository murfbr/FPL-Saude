import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  getRecurringAvailability,
  getAvailabilityOverrides,
} from '@/services/availability'
import { getServicesByProfessional } from '@/services'
import { Service, RecurringAvailability, AvailabilityOverride } from '@/types'
import { format, parseISO } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'

interface ReadOnlyAvailabilitySettingsProps {
  professionalId: string
}

const weekDays = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

export const ReadOnlyAvailabilitySettings = ({
  professionalId,
}: ReadOnlyAvailabilitySettingsProps) => {
  const [recurring, setRecurring] = useState<RecurringAvailability[]>([])
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      const [recurringRes, servicesRes, overridesRes] = await Promise.all([
        getRecurringAvailability(professionalId),
        getServicesByProfessional(professionalId),
        getAvailabilityOverrides(professionalId, currentMonth),
      ])
      setRecurring(recurringRes.data || [])
      setServices(servicesRes.data || [])
      setOverrides(overridesRes.data || [])
      setIsLoading(false)
    }
    loadData()
  }, [professionalId, currentMonth])

  const getServiceNames = (serviceIds: string[] | null) => {
    if (!serviceIds || serviceIds.length === 0) return 'Todos os serviços'
    return serviceIds
      .map((id) => services.find((s) => s.id === id)?.name)
      .filter(Boolean)
      .join(', ')
  }

  const blockedDays = overrides
    .filter((o) => !o.is_available)
    .map((o) => parseISO(o.override_date))

  const availableOverrideDays = overrides
    .filter((o) => o.is_available)
    .map((o) => parseISO(o.override_date))

  if (isLoading) return <Skeleton className="h-96 w-full" />

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Horário de Trabalho Semanal</CardTitle>
          <CardDescription>
            Sua disponibilidade padrão configurada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {weekDays.map((dayName, index) => {
            const daySlots = recurring.filter(
              (slot) => slot.day_of_week === index,
            )
            if (daySlots.length === 0) return null

            return (
              <div
                key={index}
                className="flex flex-col sm:flex-row sm:items-start border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="w-32 font-medium text-lg mb-2 sm:mb-0">
                  {dayName}
                </div>
                <div className="flex-1 space-y-2">
                  {daySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 bg-muted/30 p-2 rounded-md"
                    >
                      <Badge variant="outline" className="w-fit">
                        {slot.start_time.slice(0, 5)} -{' '}
                        {slot.end_time.slice(0, 5)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {getServiceNames(slot.service_ids)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {recurring.length === 0 && (
            <p className="text-muted-foreground text-center">
              Nenhuma disponibilidade recorrente configurada.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exceções e Bloqueios</CardTitle>
          <CardDescription>
            Dias com horários diferenciados ou bloqueados neste mês.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <Calendar
              mode="single"
              selected={undefined}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              className="rounded-md border p-3 w-fit mx-auto"
              modifiers={{
                blocked: blockedDays,
                available: availableOverrideDays,
              }}
              modifiersStyles={{
                blocked: {
                  color: 'hsl(var(--destructive))',
                  textDecoration: 'line-through',
                  fontWeight: 'bold',
                },
                available: {
                  color: 'hsl(var(--primary))',
                  fontWeight: 'bold',
                  border: '1px solid hsl(var(--primary))',
                  borderRadius: '50%',
                },
              }}
            />
          </div>
          <div className="flex-1 space-y-4">
            <h4 className="font-semibold">Legenda:</h4>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border border-primary text-primary flex items-center justify-center text-[10px] font-bold">
                D
              </div>
              <span className="text-sm">Dia com horário extra/diferente</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 text-destructive font-bold flex items-center justify-center text-[10px] line-through">
                D
              </div>
              <span className="text-sm">Dia bloqueado (folga/feriado)</span>
            </div>
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Detalhes do Mês:</h4>
              {overrides.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma exceção para este mês.
                </p>
              ) : (
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                  {overrides.map((o) => (
                    <li key={o.id} className="text-sm border-b pb-2">
                      <span className="font-medium">
                        {format(parseISO(o.override_date), 'dd/MM')}:
                      </span>{' '}
                      {o.is_available ? (
                        <>
                          Disponível {o.start_time.slice(0, 5)} -{' '}
                          {o.end_time.slice(0, 5)}
                        </>
                      ) : (
                        <span className="text-destructive">Bloqueado</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

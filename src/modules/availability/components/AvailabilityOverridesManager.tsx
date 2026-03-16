import { useState, useEffect, useMemo, useCallback } from 'react'
import { Calendar } from '@/components/ui/calendar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getAvailabilityOverrides,
  blockDay,
  removeDayOverrides,
} from '@/modules/availability/service'
import { AvailabilityOverride } from '@/shared/types'
import { format, parseISO } from 'date-fns'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useToast } from '@/shared/hooks/use-toast'

interface AvailabilityOverridesManagerProps {
  professionalId: string
}

export const AvailabilityOverridesManager = ({
  professionalId,
}: AvailabilityOverridesManagerProps) => {
  const { toast } = useToast()
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchOverrides = useCallback(async () => {
    setIsLoading(true)
    const { data } = await getAvailabilityOverrides(
      professionalId,
      currentMonth,
    )
    setOverrides(data || [])
    setIsLoading(false)
  }, [professionalId, currentMonth])

  useEffect(() => {
    fetchOverrides()
  }, [fetchOverrides])

  const { isSelectedDayBlocked } = useMemo(() => {
    if (!date) return { isSelectedDayBlocked: false }
    const selectedDayStr = format(date, 'yyyy-MM-dd')
    const dayOverride = overrides.find(
      (o) => o.override_date === selectedDayStr && !o.is_available,
    )
    return { isSelectedDayBlocked: !!dayOverride }
  }, [overrides, date])

  const blockedDays = useMemo(() => {
    return overrides
      .filter((o) => !o.is_available)
      .map((o) => parseISO(o.override_date))
  }, [overrides])

  const handleAvailabilityToggle = async (isAvailable: boolean) => {
    if (!date) return
    setIsProcessing(true)
    const promise = isAvailable
      ? removeDayOverrides(professionalId, date)
      : blockDay(professionalId, date)

    const { error } = await promise
    if (error) {
      toast({
        title: 'Erro ao atualizar disponibilidade',
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Disponibilidade atualizada com sucesso!' })
      fetchOverrides()
    }
    setIsProcessing(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bloqueios e Exceções</CardTitle>
        <CardDescription>
          Gerencie dias específicos de folga ou horários especiais.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-6">
        <div>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              className="rounded-md border p-3"
              modifiers={{ disabled: blockedDays }}
              modifiersStyles={{
                disabled: {
                  color: 'hsl(var(--destructive))',
                  textDecoration: 'line-through',
                },
              }}
            />
          )}
        </div>
        <div className="flex flex-col justify-center">
          {date ? (
            <div className="p-4 border rounded-lg space-y-4">
              <h4 className="font-semibold text-center">
                {format(date, 'dd/MM/yyyy')}
              </h4>
              <div className="flex items-center space-x-2 w-full justify-between">
                <Label htmlFor="availability-toggle" className="font-semibold">
                  {isSelectedDayBlocked ? 'Dia Bloqueado' : 'Dia Disponível'}
                </Label>
                <Switch
                  id="availability-toggle"
                  checked={!isSelectedDayBlocked}
                  onCheckedChange={handleAvailabilityToggle}
                  disabled={isProcessing}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Ative para remover o bloqueio ou desative para bloquear o dia
                inteiro para agendamentos.
              </p>
            </div>
          ) : (
            <p className="text-center text-muted-foreground">
              Selecione uma data no calendário para gerenciar.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

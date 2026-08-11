import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { cn, formatInTimeZone } from '@/shared/lib/utils'
import { format, addDays, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/shared/hooks/use-toast'
import { Schedule, Client, Service, Professional } from '@/shared/types'
import { getFilteredAvailableSchedules } from '@/modules/appointments/schedules'
import { getAvailableDatesForRange } from '@/modules/availability/service'
import { rescheduleAppointment, rescheduleFutureAppointments } from '@/shared/services'
import { getProfessionalsByService } from '@/shared/services'
import { AvailableSlots } from '@/modules/availability/components/AvailableSlots'
import { useUpdateAppointmentCache, type AppointmentsRange } from '@/modules/appointments/queries'
import { getFriendlyErrorMessage } from '@/shared/lib/error-mapping'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Repeat } from 'lucide-react'

interface RescheduleDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  oldAppointmentId: string
  client: Client
  service: Service
  professionalId: string
  onRescheduleSuccess: (shouldInvalidate?: boolean | AppointmentsRange) => void
  is_recurring?: boolean
  currentStartTime?: string
}

export const RescheduleDialog = ({
  isOpen,
  onOpenChange,
  oldAppointmentId,
  client,
  service,
  professionalId,
  onRescheduleSuccess,
  is_recurring,
  currentStartTime,
}: RescheduleDialogProps) => {
  const { toast } = useToast()
  const updateAppointmentCache = useUpdateAppointmentCache()

  // Selection State
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [selectedSlotTime, setSelectedSlotTime] = useState<string | null>(null)
  const [rescheduleMode, setRescheduleMode] = useState<'only-this' | 'this-and-future'>('only-this')

  // Data State
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [availableDates, setAvailableDates] = useState<string[] | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Loading State
  const [isLoadingDates, setIsLoadingDates] = useState(false)
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Professional selection state
  const [selectedProfessionalId, setSelectedProfessionalId] =
    useState<string>(professionalId)
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [isLoadingProfessionals, setIsLoadingProfessionals] = useState(false)

  // 1. Initialize and fetch professionals when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCurrentMonth(new Date())
      if (currentStartTime) {
        const initialDate = new Date(currentStartTime)
        setDate(initialDate)
        setCurrentMonth(initialDate)
        setSelectedSlotTime(currentStartTime)
      } else {
        setDate(undefined)
        setSelectedSlotTime(null)
      }

      // Reset professional to the one currently assigned to the appointment or keep selected if reasonable
      if (!selectedProfessionalId) {
        setSelectedProfessionalId(professionalId)
      }

      setIsLoadingProfessionals(true)
      getProfessionalsByService(service.id)
        .then((res) => {
          setProfessionals(res.data || [])
          // Ensure current professional is selected if in list, otherwise default to first or keep empty
          if (res.data && res.data.length > 0) {
            // Check if current professionalId is in the list of available professionals for this service
            const isCurrentProAvailable = res.data.some(
              (p) => p.id === professionalId,
            )
            if (isCurrentProAvailable) {
              setSelectedProfessionalId(professionalId)
            }
          }
        })
        .finally(() => {
          setIsLoadingProfessionals(false)
        })
    }
  }, [isOpen, professionalId, service.id])

  // 2. Fetch available dates
  // Fetches a wide range (starting today + 60 days) to allow flexibility in rescheduling.
  // Also ensures the currently viewed month is covered.
  useEffect(() => {
    if (isOpen && selectedProfessionalId && service.id) {
      setIsLoadingDates(true)

      const today = new Date()
      const rangeStart = today

      // Minimum 60 days window as per requirements
      let rangeEnd = addDays(today, 60)

      // Ensure we cover the currently viewed month if it extends beyond 60 days
      const currentMonthEnd = endOfMonth(currentMonth)
      if (currentMonthEnd > rangeEnd) {
        rangeEnd = currentMonthEnd
      }

      getAvailableDatesForRange(
        selectedProfessionalId,
        service.id,
        rangeStart,
        rangeEnd,
      )
        .then((res) => {
          setAvailableDates(res.data || [])
        })
        .finally(() => {
          setIsLoadingDates(false)
        })
    }
  }, [isOpen, selectedProfessionalId, service.id, currentMonth])

  // 3. Fetch schedules (slots) when date changes
  useEffect(() => {
    if (isOpen && date && selectedProfessionalId && service.id) {
      setIsLoadingSchedules(true)
      getFilteredAvailableSchedules(selectedProfessionalId, service.id, date, oldAppointmentId)
        .then((res) => {
          setSchedules(res.data || [])
          // If we have an initial slot and it's for this date, keep it selected initially
          const hasInitialSlotForThisDate = currentStartTime && res.data?.some(s => s.start_time === currentStartTime)
          if (!hasInitialSlotForThisDate) {
            setSelectedSlotTime(null)
          }
        })
        .finally(() => {
          setIsLoadingSchedules(false)
        })
    } else {
      setSchedules([])
    }
  }, [isOpen, date, selectedProfessionalId, service.id])

  const handleReschedule = async () => {
    if (!selectedSlotTime || !date || !selectedProfessionalId) return
    setIsSubmitting(true)

    const serviceFn = rescheduleMode === 'this-and-future' 
      ? rescheduleFutureAppointments 
      : rescheduleAppointment

    const { error } = await serviceFn(
      oldAppointmentId,
      selectedProfessionalId,
      selectedSlotTime,
    )

    if (error) {
      toast({
        title: 'Erro ao remarcar agendamento',
        description: getFriendlyErrorMessage(error),
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Agendamento remarcado com sucesso!' })
      
      const isSeriesMode = rescheduleMode === 'this-and-future'

      if (!isSeriesMode) {
        // Feedback imediato na view atual; a invalidação abaixo garante que o
        // agendamento apareça no período de destino (o patch não insere em
        // ranges cacheados que ainda não o contêm)
        updateAppointmentCache(oldAppointmentId, (oldAppt) => {
          const newAppt = { ...oldAppt }
          newAppt.professional_id = selectedProfessionalId
          const prof = professionals.find((p) => p.id === selectedProfessionalId)
          if (prof) {
            newAppt.professionals = { id: prof.id, name: prof.name }
          }
          newAppt.schedules = {
            ...newAppt.schedules,
            start_time: selectedSlotTime,
            end_time: new Date(new Date(selectedSlotTime).getTime() + (service.duration_minutes || 60) * 60000).toISOString()
          }
          return newAppt
        })
      }

      // Invalida apenas o período afetado: da origem ou do destino (o que vier
      // primeiro) até o outro extremo — série deslocada afeta dali em diante
      const from =
        currentStartTime && currentStartTime < selectedSlotTime
          ? currentStartTime
          : selectedSlotTime
      const to = isSeriesMode
        ? undefined
        : currentStartTime && currentStartTime > selectedSlotTime
          ? currentStartTime
          : selectedSlotTime
      onRescheduleSuccess({ from, to })
      onOpenChange(false)
    }
    setIsSubmitting(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Remarcar Agendamento</DialogTitle>
          <DialogDescription>
            Selecione um profissional, uma nova data e horário para{' '}
            {client.name} ({service.name}).
            <br />
            <span className="text-xs text-muted-foreground mr-2">
              Mostrando apenas horários a partir das 07:00.
            </span>
            {service.max_attendees > 1 && (
              <span className="inline-block mt-1 text-orange-700 font-medium text-xs">
                Nota: Horários com vagas parciais são indicados em laranja.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {is_recurring && (
            <div className="space-y-3 bg-muted/30 p-4 rounded-lg border border-primary/10">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Repeat className="w-4 h-4 text-primary" />
                Este é um agendamento recorrente
              </label>
              <RadioGroup
                value={rescheduleMode}
                onValueChange={(val: any) => setRescheduleMode(val)}
                className="flex flex-col space-y-2 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="only-this" id="only-this" />
                  <Label htmlFor="only-this" className="font-normal cursor-pointer">
                    Apenas este agendamento
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="this-and-future" id="this-and-future" />
                  <Label htmlFor="this-and-future" className="font-normal cursor-pointer">
                    Este e todos os futuros agendamentos da série
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium">Profissional</label>
            <Select
              value={selectedProfessionalId}
              onValueChange={(val) => {
                setSelectedProfessionalId(val)
                setDate(undefined)
                setSchedules([])
              }}
              disabled={isLoadingProfessionals || isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o profissional" />
              </SelectTrigger>
              <SelectContent>
                {professionals.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    {isLoadingProfessionals
                      ? 'Carregando...'
                      : 'Nenhum profissional disponível'}
                  </div>
                ) : (
                  professionals.map((prof) => (
                    <SelectItem key={prof.id} value={prof.id}>
                      {prof.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium">Nova Data</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={'outline'}
                  className={cn(
                    'w-full pl-3 text-left font-normal',
                    !date && 'text-muted-foreground',
                  )}
                  disabled={!selectedProfessionalId || isSubmitting}
                >
                  {date ? (
                    format(date, 'PPP', { locale: ptBR })
                  ) : (
                    <span>Escolha uma data</span>
                  )}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  disabled={(day) => {
                    // Check against Brazil time "Today" to handle client timezone differences
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const todayStr = formatInTimeZone(new Date(), 'yyyy-MM-dd')

                    if (dateStr < todayStr) return true

                    // If available dates are loaded, disable any date not in the list
                    if (availableDates) {
                      return !availableDates.includes(dateStr)
                    }
                    return false
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {date && (
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium">Novo Horário</label>
              <AvailableSlots
                schedules={schedules}
                isLoading={isLoadingSchedules}
                selectedSlotTime={selectedSlotTime}
                onSlotSelect={(schedule) =>
                  setSelectedSlotTime(schedule.start_time)
                }
              />
              {selectedSlotTime && (
                <p className="text-sm text-muted-foreground mt-2">
                  Horário selecionado:{' '}
                  {formatInTimeZone(
                    selectedSlotTime,
                    "dd 'de' MMMM 'às' HH:mm",
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleReschedule}
            disabled={!selectedSlotTime || isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Remarcando...' : 'Confirmar Remarcação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

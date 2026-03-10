import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  CalendarIcon,
  CheckCircle,
  Repeat,
  Loader2,
  ExternalLink,
  DollarSign,
  Percent,
} from 'lucide-react'
import { cn, formatInTimeZone } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'
import {
  Client,
  Professional,
  Service,
  Schedule,
  ClientPackageWithDetails,
  ClientSubscription,
  PartnershipDiscount,
} from '@/types'
import {
  getAllClients,
  getClientPackages,
  getClientSubscriptions,
} from '@/services'
import { getProfessionalsByService } from '@/services'
import {
  getFilteredAvailableSchedules,
  getAvailableProfessionalsAtSlot,
} from '@/services/schedules'
import { getAvailableDatesForProfessional } from '@/services/availability'
import { getAllServices } from '@/services'
import {
  bookAppointment,
  bookRecurringAppointments,
} from '@/services'
import { getDiscountsForPartnership } from '@/services'
import { AvailableSlots } from '@/components/AvailableSlots'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/providers/AuthProvider'
import { ClientSelector } from './ClientSelector'
import { getFriendlyErrorMessage } from '@/lib/error-mapping'
import { Badge } from '@/components/ui/badge'

const appointmentSchema = z
  .object({
    clientId: z.string().uuid('Selecione um cliente.'),
    serviceId: z.string().uuid('Selecione um serviço.'),
    professionalId: z.string().uuid('Selecione um profissional.'),
    date: z.date({ required_error: 'Selecione uma data.' }),
    startTime: z.string().min(1, 'Selecione um horário.'),
    usePackage: z.boolean().default(true),
    packageId: z.string().optional(),
    isRecurring: z.boolean().default(false),
    recurrenceWeeks: z.coerce
      .number()
      .min(2, 'Mínimo de 2 semanas para recorrência')
      .max(52, 'Máximo de 52 semanas (1 ano)')
      .optional(),
    discount: z.coerce.number().min(0).optional(),
  })
  .refine(
    (data) => {
      if (data.isRecurring) {
        return !!data.recurrenceWeeks && data.recurrenceWeeks >= 2
      }
      return true
    },
    {
      message: 'Defina a duração da recorrência (mínimo 2 semanas).',
      path: ['recurrenceWeeks'],
    },
  )

type AppointmentFormValues = z.infer<typeof appointmentSchema>

interface AppointmentFormDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onAppointmentCreated: () => void
  initialDate?: Date
  isSpecificTimeSlot?: boolean
  preselectedProfessionalId?: string
}

export const AppointmentFormDialog = ({
  isOpen,
  onOpenChange,
  onAppointmentCreated,
  initialDate,
  isSpecificTimeSlot = false,
  preselectedProfessionalId,
}: AppointmentFormDialogProps) => {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { role } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [availableDates, setAvailableDates] = useState<string[] | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isLoading, setIsLoading] = useState({
    clients: true,
    services: false,
    professionals: false,
    schedules: false,
    dates: false,
  })

  // Entitlements & Discounts
  const [availablePackages, setAvailablePackages] = useState<
    ClientPackageWithDetails[]
  >([])
  const [activeSubscription, setActiveSubscription] =
    useState<ClientSubscription | null>(null)
  const [checkingEntitlements, setCheckingEntitlements] = useState(false)
  const [appliedPartnershipDiscount, setAppliedPartnershipDiscount] =
    useState<PartnershipDiscount | null>(null)

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      usePackage: true,
      professionalId: preselectedProfessionalId || '',
      date: initialDate || undefined,
      isRecurring: false,
      recurrenceWeeks: 4,
      startTime: '',
      serviceId: '',
      clientId: '',
      discount: 0,
    },
  })

  const clientId = form.watch('clientId')
  const serviceId = form.watch('serviceId')
  const professionalId = form.watch('professionalId')
  const date = form.watch('date')
  const usePackage = form.watch('usePackage')
  const isRecurring = form.watch('isRecurring')
  const discount = form.watch('discount') || 0

  const selectedService = services.find((s) => s.id === serviceId)
  const selectedClient = clients.find((c) => c.id === clientId)

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      const initializeForm = async () => {
        setIsLoading((prev) => ({ ...prev, clients: true, services: true }))
        const { data: clientsData } = await getAllClients({ status: 'active' })
        setClients(clientsData || [])
        const { data: servicesData } = await getAllServices()
        setServices(servicesData || [])
        setIsLoading((prev) => ({ ...prev, clients: false, services: false }))

        if (initialDate) {
          form.setValue('date', initialDate)
          setCurrentMonth(initialDate)
          if (isSpecificTimeSlot) {
            form.setValue('startTime', initialDate.toISOString())
          }
        }
      }
      initializeForm()
    } else {
      form.reset({
        usePackage: true,
        professionalId: preselectedProfessionalId || '',
        date: initialDate || undefined,
        isRecurring: false,
        recurrenceWeeks: 4,
        startTime: '',
        serviceId: '',
        clientId: '',
        discount: 0,
      })
      setSchedules([])
      setProfessionals([])
      setAvailablePackages([])
      setActiveSubscription(null)
      setAppliedPartnershipDiscount(null)
    }
  }, [isOpen, initialDate, form, preselectedProfessionalId, isSpecificTimeSlot])

  // Fetch Professionals
  useEffect(() => {
    const fetchProfessionals = async () => {
      if (!serviceId) {
        setProfessionals([])
        return
      }
      setIsLoading((prev) => ({ ...prev, professionals: true }))

      let availablePros: Professional[] = []
      if (isSpecificTimeSlot && initialDate) {
        const result = await getAvailableProfessionalsAtSlot(
          serviceId,
          initialDate,
        )
        availablePros = result.data || []
      } else {
        const result = await getProfessionalsByService(serviceId)
        availablePros = result.data || []
      }

      setProfessionals(availablePros)
      setIsLoading((prev) => ({ ...prev, professionals: false }))

      const currentProfId = form.getValues('professionalId')
      if (currentProfId && !availablePros.find((p) => p.id === currentProfId)) {
        form.setValue('professionalId', '')
      }
    }
    fetchProfessionals()
  }, [serviceId, initialDate, isSpecificTimeSlot, form])

  // Check entitlements (Subscriptions, Packages) and Discounts
  useEffect(() => {
    const checkEntitlementsAndDiscounts = async () => {
      if (!clientId || !serviceId) {
        setAvailablePackages([])
        setActiveSubscription(null)
        setAppliedPartnershipDiscount(null)
        form.setValue('discount', 0)
        return
      }

      setCheckingEntitlements(true)

      // 1. Check Subscriptions
      const { data: subs } = await getClientSubscriptions(clientId)
      const matchingSub =
        subs?.find((sub) => sub.service_id === serviceId) || null
      setActiveSubscription(matchingSub)

      // 2. Check Packages
      const { data: pkgs } = await getClientPackages(clientId)
      const matchingPackages =
        pkgs?.filter((pkg) => pkg.packages.service_id === serviceId) || []
      setAvailablePackages(matchingPackages)

      // 3. Check Partnership Discounts
      let foundDiscount: PartnershipDiscount | null = null
      const client = clients.find((c) => c.id === clientId)
      const service = services.find((s) => s.id === serviceId)

      if (client?.partnership_id && service) {
        const { data: discounts } = await getDiscountsForPartnership(
          client.partnership_id,
        )
        // Find specific service discount or global partnership discount
        foundDiscount =
          discounts?.find(
            (d) => d.service_id === serviceId || d.service_id === null,
          ) || null

        if (foundDiscount) {
          const discountAmount =
            service.price * (foundDiscount.discount_percentage / 100)
          form.setValue('discount', parseFloat(discountAmount.toFixed(2)))
          setAppliedPartnershipDiscount(foundDiscount)
        } else {
          form.setValue('discount', 0)
          setAppliedPartnershipDiscount(null)
        }
      } else {
        form.setValue('discount', 0)
        setAppliedPartnershipDiscount(null)
      }

      // Default logic for packages/subscription selection
      if (!matchingSub && matchingPackages.length > 0) {
        form.setValue('packageId', matchingPackages[0].id)
        form.setValue('usePackage', true)
      } else {
        form.setValue('packageId', undefined)
        if (matchingPackages.length === 0) {
          form.setValue('usePackage', false)
        }
      }

      setCheckingEntitlements(false)
    }

    checkEntitlementsAndDiscounts()
  }, [clientId, serviceId, form, clients, services])

  // Available Dates & Slots (Manual Mode)
  useEffect(() => {
    if (!isSpecificTimeSlot && professionalId && serviceId) {
      setIsLoading((prev) => ({ ...prev, dates: true }))
      getAvailableDatesForProfessional(professionalId, serviceId, currentMonth)
        .then((res) => setAvailableDates(res.data || []))
        .finally(() => setIsLoading((prev) => ({ ...prev, dates: false })))
    } else {
      setAvailableDates(null)
    }
  }, [professionalId, serviceId, currentMonth, isSpecificTimeSlot])

  useEffect(() => {
    if (!isSpecificTimeSlot && professionalId && serviceId && date) {
      setIsLoading((prev) => ({ ...prev, schedules: true }))
      getFilteredAvailableSchedules(professionalId, serviceId, date).then(
        (res) => {
          const slots = res.data || []
          setSchedules(slots)
          if (initialDate && initialDate.getDate() === date.getDate()) {
            const targetTime = formatInTimeZone(initialDate, 'HH:mm')
            const matchingSlot = slots.find(
              (s) => formatInTimeZone(s.start_time, 'HH:mm') === targetTime,
            )
            if (matchingSlot) {
              form.setValue('startTime', matchingSlot.start_time)
            }
          }
          setIsLoading((prev) => ({ ...prev, schedules: false }))
        },
      )
    } else if (!isSpecificTimeSlot) {
      setSchedules([])
    }
  }, [professionalId, serviceId, date, form, initialDate, isSpecificTimeSlot])

  const handleNavigateToProfile = () => {
    if (!clientId) return
    onOpenChange(false)
    const basePath =
      role === 'admin' ? '/admin/pacientes' : '/profissional/pacientes'
    navigate(`${basePath}/${clientId}`)
  }

  const onSubmit = async (values: AppointmentFormValues) => {
    const hasActiveSubscription = !!activeSubscription
    const usesPackage =
      values.usePackage &&
      !hasActiveSubscription &&
      availablePackages.length > 0

    const packageIdToUse = usesPackage ? values.packageId : undefined

    // If covered by plan or package, discount/price fields should be ignored/zeroed in terms of payment
    const discountToUse =
      hasActiveSubscription || usesPackage ? 0 : values.discount || 0

    try {
      let result
      if (
        values.isRecurring &&
        values.recurrenceWeeks &&
        values.recurrenceWeeks >= 2
      ) {
        result = await bookRecurringAppointments(
          values.professionalId,
          values.clientId,
          values.serviceId,
          values.startTime,
          values.recurrenceWeeks,
          packageIdToUse,
          discountToUse,
        )
      } else {
        result = await bookAppointment(
          values.professionalId,
          values.clientId,
          values.serviceId,
          values.startTime,
          packageIdToUse,
          values.isRecurring,
          discountToUse,
        )
      }

      if (result.error) {
        toast({
          title: 'Erro ao agendar',
          description: getFriendlyErrorMessage(result.error),
          variant: 'destructive',
        })
      } else {
        toast({ title: 'Agendamento(s) criado(s) com sucesso!' })
        onAppointmentCreated()
        onOpenChange(false)
      }
    } catch (err: any) {
      toast({
        title: 'Erro inesperado',
        description: getFriendlyErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const originalPrice = selectedService?.price || 0
  const finalPrice = Math.max(0, originalPrice - discount)

  const isPackageMode =
    !activeSubscription && usePackage && availablePackages.length > 0
  const isSubscriptionMode = !!activeSubscription
  const isCasualMode = !isSubscriptionMode && !isPackageMode

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
          <DialogDescription>
            {isSpecificTimeSlot && initialDate
              ? `Agendamento para ${format(initialDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
              : 'Configure o agendamento.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 1. Client */}
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Cliente</FormLabel>
                  <FormControl>
                    <ClientSelector
                      clients={clients}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isLoading.clients}
                      isLoading={isLoading.clients}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 2. Service */}
            <FormField
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serviço</FormLabel>
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val)
                      form.setValue('professionalId', '')
                    }}
                    defaultValue={field.value}
                    disabled={isLoading.services}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o serviço" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} - R$ {s.price.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 3. Professional */}
            <FormField
              control={form.control}
              name="professionalId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profissional</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!serviceId || isLoading.professionals}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o profissional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {professionals.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          {serviceId
                            ? 'Nenhum profissional disponível'
                            : 'Selecione um serviço primeiro'}
                        </div>
                      ) : (
                        professionals.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Financial Section */}
            {clientId && serviceId && (
              <div className="p-4 bg-muted/30 rounded-lg border">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  Financeiro
                </h4>

                {checkingEntitlements ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Verificando planos e descontos...
                  </div>
                ) : (
                  <>
                    {/* Subscription Mode */}
                    {isSubscriptionMode && (
                      <div className="flex flex-col gap-2 p-3 bg-green-50 border border-green-100 rounded-md">
                        <div className="flex items-center text-green-700 gap-2 text-sm font-medium">
                          <CheckCircle className="w-4 h-4" />
                          <span>Coberto por Assinatura</span>
                        </div>
                        <div className="text-sm text-green-600 ml-6">
                          {activeSubscription?.subscription_plans?.name ||
                            'Plano Mensal Ativo'}
                        </div>
                      </div>
                    )}

                    {/* Package Option */}
                    {!isSubscriptionMode && availablePackages.length > 0 && (
                      <FormField
                        control={form.control}
                        name="usePackage"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 mb-3">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Usar Pacote de Sessões</FormLabel>
                              <FormDescription>
                                {availablePackages.length} pacote(s) disponível.
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Package Mode */}
                    {isPackageMode && (
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                        <FormField
                          control={form.control}
                          name="packageId"
                          render={({ field }) => (
                            <FormItem>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o pacote" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {availablePackages.map((pkg) => (
                                    <SelectItem key={pkg.id} value={pkg.id}>
                                      {pkg.packages.name} (
                                      {pkg.sessions_remaining} restantes)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-blue-700 text-sm flex gap-2 items-center">
                          <CheckCircle className="w-4 h-4" />
                          <span>
                            Sessão coberta por pacote. Nenhum pagamento avulso
                            necessário.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Casual Mode (or Paid) */}
                    {isCasualMode && (
                      <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-amber-600 border-amber-200 bg-amber-50"
                            >
                              Sessão Avulsa
                            </Badge>
                            {appliedPartnershipDiscount && (
                              <Badge
                                variant="secondary"
                                className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1"
                              >
                                <Percent className="w-3 h-3" />
                                Parceria {selectedClient?.partnerships?.name} (
                                {appliedPartnershipDiscount.discount_percentage}
                                %)
                              </Badge>
                            )}
                          </div>
                          {availablePackages.length === 0 && (
                            <Button
                              variant="link"
                              className="p-0 h-auto text-xs"
                              onClick={handleNavigateToProfile}
                              type="button"
                            >
                              Ver Contratos{' '}
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </Button>
                          )}
                        </div>

                        <FormField
                          control={form.control}
                          name="discount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Desconto (R$)</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    type="number"
                                    className="pl-9"
                                    placeholder="0,00"
                                    min={0}
                                    step="0.01"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormDescription>
                                {appliedPartnershipDiscount
                                  ? 'Desconto aplicado automaticamente pela parceria.'
                                  : 'Insira um valor se houver desconto manual.'}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="space-y-1 pt-2 border-t">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">
                              Valor do Serviço:
                            </span>
                            <span>R$ {originalPrice.toFixed(2)}</span>
                          </div>
                          {discount > 0 && (
                            <div className="flex justify-between items-center text-sm text-green-600">
                              <span>Desconto:</span>
                              <span>- R$ {discount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-base pt-1">
                            <span className="font-medium">Total a Pagar:</span>
                            <span className="font-bold text-green-600">
                              R$ {finalPrice.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Recurring */}
            <div className="space-y-2">
              <FormField
                control={form.control}
                name="isRecurring"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted/20">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none w-full">
                      <FormLabel className="flex items-center gap-2">
                        <Repeat className="w-4 h-4 text-primary" />
                        Repetir semanalmente
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {isRecurring && (
                <FormField
                  control={form.control}
                  name="recurrenceWeeks"
                  render={({ field }) => (
                    <FormItem className="border rounded-md p-4 bg-muted/10">
                      <FormLabel className="flex justify-between">
                        Duração da Recorrência
                        <span className="text-xs text-muted-foreground font-normal">
                          Max: 52 semanas
                        </span>
                      </FormLabel>
                      <div className="flex gap-2 items-center">
                        <FormControl>
                          <Input
                            type="number"
                            min={2}
                            max={52}
                            className="w-24"
                            {...field}
                          />
                        </FormControl>
                        <span className="text-sm text-muted-foreground">
                          semanas
                        </span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Date/Time (Manual) */}
            {!isSpecificTimeSlot && (
              <>
                <div className="flex gap-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Data</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={'outline'}
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground',
                                )}
                              >
                                {field.value ? (
                                  format(field.value, 'PPP', { locale: ptBR })
                                ) : (
                                  <span>Escolha uma data</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              month={currentMonth}
                              onMonthChange={setCurrentMonth}
                              disabled={(day) => {
                                if (
                                  day <
                                  new Date(new Date().setHours(0, 0, 0, 0))
                                )
                                  return true
                                if (
                                  professionalId &&
                                  serviceId &&
                                  availableDates
                                ) {
                                  return !availableDates.includes(
                                    format(day, 'yyyy-MM-dd'),
                                  )
                                }
                                return false
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário</FormLabel>
                      <FormControl>
                        <AvailableSlots
                          schedules={schedules}
                          isLoading={isLoading.schedules}
                          selectedSlotTime={field.value}
                          onSlotSelect={(schedule) =>
                            field.onChange(schedule.start_time)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  form.formState.isSubmitting ||
                  !form.watch('startTime') ||
                  !form.watch('clientId') ||
                  !form.watch('serviceId') ||
                  !form.watch('professionalId')
                }
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Agendando...
                  </>
                ) : (
                  'Confirmar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

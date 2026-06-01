import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useToast } from '@/shared/hooks/use-toast'
import { formatInTimeZone } from '@/shared/lib/utils'
import { getFriendlyErrorMessage } from '@/shared/lib/error-mapping'

import {
  Client,
  Professional,
  Service,
  Schedule,
  ClientPackageWithDetails,
  ClientSubscription,
  PartnershipDiscount,
} from '@/shared/types'
import {
  getAllClients,
  getClientPackages,
  getClientSubscriptions,
  getProfessionalsByService,
  getAllServices,
  getDiscountsForPartnership,
} from '@/shared/services'
import {
  getFilteredAvailableSchedules,
  getAvailableProfessionalsAtSlot,
} from '@/modules/appointments/schedules'
import { getAvailableDatesForProfessional, getRecurringAvailability } from '@/modules/availability/service'
import { useBookAppointmentMutation } from '@/modules/appointments/hooks/useAppointments'
import { bookRecurringAppointments } from '@/shared/services'
import { useAuth } from '@/shared/providers/AuthProvider'

export const appointmentSchema = z
  .object({
    clientId: z.string().min(1, 'Selecione um cliente.'),
    serviceId: z.string().min(1, 'Selecione um serviço.'),
    professionalId: z.string().min(1, 'Selecione um profissional.'),
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
    recurrenceDays: z.array(z.number()).optional(),
    discount: z.coerce.number().min(0).optional(),
  })
  .refine(
    (data) => {
      if (data.isRecurring) {
        return !!data.recurrenceWeeks && data.recurrenceWeeks >= 2 && !!data.recurrenceDays && data.recurrenceDays.length > 0
      }
      return true
    },
    {
      message: 'Defina a duração e ao menos um dia da semana para recorrência.',
      path: ['recurrenceWeeks'],
    },
  )

export type AppointmentFormValues = z.infer<typeof appointmentSchema>

export function useAppointmentForm({
  isOpen,
  onOpenChange,
  onAppointmentCreated,
  initialDate,
  isSpecificTimeSlot,
  preselectedProfessionalId,
}: {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onAppointmentCreated: () => void
  initialDate?: Date
  isSpecificTimeSlot?: boolean
  preselectedProfessionalId?: string
}) {
  const { toast } = useToast()
  const { role } = useAuth()
  const bookMutation = useBookAppointmentMutation()

  const [clients, setClients] = useState<Client[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [availableDates, setAvailableDates] = useState<string[] | null>(null)
  const [availableWeekdays, setAvailableWeekdays] = useState<number[] | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isLoading, setIsLoading] = useState({
    clients: true,
    services: false,
    professionals: false,
    schedules: false,
    dates: false,
  })

  const [availablePackages, setAvailablePackages] = useState<ClientPackageWithDetails[]>([])
  const [exhaustedPackages, setExhaustedPackages] = useState<ClientPackageWithDetails[]>([])
  const [allowExhausted, setAllowExhausted] = useState(false)
  const [activeSubscription, setActiveSubscription] = useState<ClientSubscription | null>(null)
  const [checkingEntitlements, setCheckingEntitlements] = useState(false)
  const [appliedPartnershipDiscount, setAppliedPartnershipDiscount] = useState<PartnershipDiscount | null>(null)

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      usePackage: true,
      professionalId: preselectedProfessionalId || '',
      date: initialDate || undefined,
      isRecurring: false,
      recurrenceWeeks: 4,
      recurrenceDays: [],
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
  const discountValue = form.watch('discount')
  const discount = typeof discountValue === 'number' ? discountValue : parseFloat(String(discountValue || 0)) || 0

  const selectedService = services.find((s) => s.id === serviceId)
  const selectedClient = clients.find((c) => c.id === clientId)

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
        recurrenceDays: [],
        startTime: '',
        serviceId: '',
        clientId: '',
        discount: 0,
      })
      setSchedules([])
      setProfessionals([])
      setAvailablePackages([])
      setExhaustedPackages([])
      setAllowExhausted(false)
      setActiveSubscription(null)
      setAppliedPartnershipDiscount(null)
      setAvailableWeekdays(null)
    }
  }, [isOpen, initialDate, form, preselectedProfessionalId, isSpecificTimeSlot])

  useEffect(() => {
    const fetchProfessionals = async () => {
      if (!serviceId) {
        setProfessionals([])
        return
      }
      setIsLoading((prev) => ({ ...prev, professionals: true }))

      let availablePros: Professional[] = []
      if (isSpecificTimeSlot && initialDate) {
        const result = await getAvailableProfessionalsAtSlot(serviceId, initialDate)
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

      const { data: subs } = await getClientSubscriptions(clientId)
      const matchingSub = subs?.find((sub) => sub.service_id === serviceId) || null
      setActiveSubscription(matchingSub)

      const { data: pkgs } = await getClientPackages(clientId)
      const matchingPackages = pkgs?.filter((pkg) => pkg.packages.service_id === serviceId) || []
      
      const validPackages = matchingPackages.filter(p => (p.sessions_remaining || 0) > 0 && p.status !== 'cancelled' && p.status !== 'terminated')
      const exhausted = matchingPackages.filter(p => (p.sessions_remaining || 0) <= 0)

      setAvailablePackages(validPackages)
      setExhaustedPackages(exhausted)
      setAllowExhausted(false)

      let foundDiscount: PartnershipDiscount | null = null
      const client = clients.find((c) => c.id === clientId)
      const service = services.find((s) => s.id === serviceId)

      if (client?.partnership_id && service) {
        const { data: discounts } = await getDiscountsForPartnership(client.partnership_id)
        foundDiscount = discounts?.find((d) => d.service_id === serviceId || d.service_id === null) || null

        if (foundDiscount) {
          const discountAmount = service.price * (foundDiscount.discount_percentage / 100)
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

      if (!matchingSub && validPackages.length > 0) {
        form.setValue('packageId', validPackages[0].id)
        form.setValue('usePackage', true)
      } else {
        form.setValue('packageId', undefined)
        form.setValue('usePackage', false)
      }

      setCheckingEntitlements(false)
    }

    checkEntitlementsAndDiscounts()
  }, [clientId, serviceId, form, clients, services])

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
    if (isRecurring && professionalId && serviceId) {
      getRecurringAvailability(professionalId).then(res => {
        if (res.data && res.data.length > 0) {
          let rules = res.data.filter(r => !r.service_ids || r.service_ids.includes(serviceId))
          const selectedTime = form.getValues('startTime')
          if (selectedTime) {
             const timeStr = formatInTimeZone(new Date(selectedTime), 'HH:mm')
             rules = rules.filter(r => timeStr >= r.start_time.substring(0, 5) && timeStr < r.end_time.substring(0, 5))
          }

          const days = Array.from(new Set(rules.map(r => r.day_of_week)))
          setAvailableWeekdays(days)
          
          const currentDays = form.getValues('recurrenceDays') || []
          const validSelectedDays = currentDays.filter(dayId => {
             const dbDay = dayId === 0 ? 7 : dayId
             return days.includes(dbDay)
          })
          if (validSelectedDays.length !== currentDays.length) {
             form.setValue('recurrenceDays', validSelectedDays)
          }

        } else {
          setAvailableWeekdays([])
          form.setValue('recurrenceDays', [])
        }
      })
    } else {
      setAvailableWeekdays(null)
    }
  }, [isRecurring, professionalId, serviceId, form])

  useEffect(() => {
    if (!isSpecificTimeSlot && professionalId && serviceId && date) {
      setIsLoading((prev) => ({ ...prev, schedules: true }))
      getFilteredAvailableSchedules(professionalId, serviceId, date).then((res) => {
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
      })
    } else if (!isSpecificTimeSlot) {
      setSchedules([])
    }
  }, [professionalId, serviceId, date, form, initialDate, isSpecificTimeSlot])

  const displayablePackages = allowExhausted ? [...availablePackages, ...exhaustedPackages] : availablePackages

  const onSubmit = async (values: AppointmentFormValues) => {
    const hasActiveSubscription = !!activeSubscription
    const usesPackage = values.usePackage && !hasActiveSubscription && displayablePackages.length > 0
    const packageIdToUse = usesPackage ? values.packageId : undefined
    const discountToUse = hasActiveSubscription || usesPackage ? 0 : values.discount || 0

    try {
      if (
        values.isRecurring &&
        values.recurrenceWeeks &&
        values.recurrenceWeeks >= 2 &&
        values.recurrenceDays && 
        values.recurrenceDays.length > 0
      ) {
        const result = await bookRecurringAppointments(
          values.professionalId,
          values.clientId,
          values.serviceId,
          values.startTime,
          values.recurrenceWeeks,
          values.recurrenceDays,
          packageIdToUse,
          discountToUse,
        )
        if (result.error) throw result.error
        toast({ title: 'Agendamento(s) criado(s) com sucesso!' })
        onAppointmentCreated()
        onOpenChange(false)
      } else {
        bookMutation.mutate({
          professionalId: values.professionalId,
          clientId: values.clientId,
          serviceId: values.serviceId,
          startTime: values.startTime,
          clientPackageId: packageIdToUse,
          isRecurring: values.isRecurring,
          discountAmount: discountToUse,
        }, {
          onSuccess: () => {
            toast({ title: 'Agendamento(s) criado(s) com sucesso!' })
            onAppointmentCreated()
            onOpenChange(false)
          },
          onError: (error: any) => {
            toast({
              title: 'Erro ao agendar',
              description: getFriendlyErrorMessage(error),
              variant: 'destructive',
            })
          }
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro inesperado',
        description: getFriendlyErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  return {
    form,
    state: {
      role,
      clients,
      professionals,
      services,
      schedules,
      availableDates,
      availableWeekdays,
      currentMonth,
      isLoading,
      availablePackages,
      exhaustedPackages,
      allowExhausted,
      activeSubscription,
      checkingEntitlements,
      appliedPartnershipDiscount,
      displayablePackages,
      clientId,
      serviceId,
      professionalId,
      isRecurring,
      discount,
      selectedService,
      selectedClient,
    },
    actions: {
      setCurrentMonth,
      setAllowExhausted,
      onSubmit,
    }
  }
}

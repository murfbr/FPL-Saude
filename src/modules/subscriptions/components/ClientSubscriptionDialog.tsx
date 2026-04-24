import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/shared/hooks/use-toast'
import { 
  createClientSubscription, 
  getServices, 
  getSubscriptionPlans, 
  getClientById, 
  getDiscountsForPartnership 
} from '@/shared/services'
import { Service, SubscriptionPlan, PartnershipDiscount } from '@/shared/types'
import { format } from 'date-fns'
import { Percent } from 'lucide-react'

const subscriptionSchema = z.object({
  serviceId: z.string().min(1, 'Selecione um serviço.'),
  planId: z.string().min(1, 'Selecione um plano.'),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Data inválida',
  }),
})

type SubscriptionFormValues = z.infer<typeof subscriptionSchema>

interface ClientSubscriptionDialogProps {
  clientId: string
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onSubscriptionCreated: () => void
}

export const ClientSubscriptionDialog = ({
  clientId,
  isOpen,
  onOpenChange,
  onSubscriptionCreated,
}: ClientSubscriptionDialogProps) => {
  const { toast } = useToast()
  const [services, setServices] = useState<Service[]>([])
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [filteredPlans, setFilteredPlans] = useState<SubscriptionPlan[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clientPartnershipId, setClientPartnershipId] = useState<string | null>(null)
  const [partnershipDiscounts, setPartnershipDiscounts] = useState<PartnershipDiscount[]>([])
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<SubscriptionPlan | null>(null)

  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      startDate: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  useEffect(() => {
    if (isOpen) {
      Promise.all([getServices(), getSubscriptionPlans(), getClientById(clientId)]).then(
        ([servicesRes, plansRes, clientRes]) => {
          setServices(servicesRes.data || [])
          setPlans(plansRes.data || [])
          
          if (clientRes.data?.partnership_id) {
            setClientPartnershipId(clientRes.data.partnership_id)
            getDiscountsForPartnership(clientRes.data.partnership_id).then((res) => {
              setPartnershipDiscounts(res.data || [])
            })
          }
        },
      )
    } else {
      setClientPartnershipId(null)
      setPartnershipDiscounts([])
      setSelectedPlanDetails(null)
    }
  }, [isOpen, clientId])

  const selectedServiceId = form.watch('serviceId')
  const selectedPlanId = form.watch('planId')

  useEffect(() => {
    if (selectedServiceId) {
      const filtered = plans.filter((p) => p.service_id === selectedServiceId)
      setFilteredPlans(filtered)
      if (!filtered.some((p) => p.id === form.getValues('planId'))) {
        form.setValue('planId', '')
      }
    } else {
      setFilteredPlans([])
    }
  }, [selectedServiceId, plans, form])

  useEffect(() => {
    if (selectedPlanId) {
       setSelectedPlanDetails(plans.find(p => p.id === selectedPlanId) || null)
    } else {
       setSelectedPlanDetails(null)
    }
  }, [selectedPlanId, plans])

  let finalPrice = 0
  let originalPrice = 0
  let appliedDiscount: PartnershipDiscount | null = null

  if (selectedPlanDetails) {
    originalPrice = selectedPlanDetails.price
    finalPrice = originalPrice

    if (clientPartnershipId && partnershipDiscounts.length > 0) {
       const discount = partnershipDiscounts.find(d => d.service_id === selectedServiceId || d.service_id === null)
       if (discount) {
          appliedDiscount = discount
          const discountAmount = originalPrice * (discount.discount_percentage / 100)
          finalPrice = Math.max(0, originalPrice - discountAmount)
       }
    }
  }

  const onSubmit = async (values: SubscriptionFormValues) => {
    setIsSubmitting(true)
    const discountValue = originalPrice - finalPrice

    const { error } = await createClientSubscription({
      client_id: clientId,
      service_id: values.serviceId,
      subscription_plan_id: values.planId,
      start_date: new Date(values.startDate).toISOString(),
      end_date: null,
      status: 'active',
      amount: finalPrice,
      discount_amount: discountValue
    })

    if (error) {
      toast({
        title: 'Erro ao criar assinatura',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Assinatura criada com sucesso!' })
      onSubscriptionCreated()
      onOpenChange(false)
      form.reset({ startDate: format(new Date(), 'yyyy-MM-dd') })
    }
    setIsSubmitting(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Assinatura Mensal</DialogTitle>
          <DialogDescription>
            Ative um plano mensal para o paciente.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serviço</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o serviço" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {services.length > 0 ? (
                        services.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground">
                          Nenhum serviço cadastrado.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="planId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plano</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!selectedServiceId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o plano" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredPlans.length > 0 ? (
                        filteredPlans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} - R$ {p.price.toFixed(2)}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground">
                          {selectedServiceId
                            ? 'Nenhum plano disponível para este serviço.'
                            : 'Selecione um serviço primeiro.'}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Início</FormLabel>
                  <FormControl>
                    <input
                      type="date"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedPlanDetails && (
              <div className="p-4 bg-muted/30 rounded-lg border space-y-2 mt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor Original:</span>
                  <span>R$ {originalPrice.toFixed(2)}</span>
                </div>
                
                {appliedDiscount && (
                  <div className="flex justify-between text-sm text-green-600 items-center">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      Desconto de Parceria ({appliedDiscount.discount_percentage}%)
                    </span>
                    <span>- R$ {(originalPrice - finalPrice).toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between font-medium pt-2 border-t text-base">
                  <span>Valor Final da Assinatura:</span>
                  <span>R$ {finalPrice.toFixed(2)}</span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="submit"
                disabled={isSubmitting || !form.watch('planId')}
              >
                {isSubmitting ? 'Salvando...' : 'Ativar Assinatura'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

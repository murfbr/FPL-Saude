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
import { useToast } from '@/hooks/use-toast'
import { createClientSubscription } from '@/services'
import { getServices } from '@/services'
import { getSubscriptionPlans } from '@/services'
import { Service, SubscriptionPlan } from '@/types'
import { format } from 'date-fns'

const subscriptionSchema = z.object({
  serviceId: z.string().uuid('Selecione um serviço.'),
  planId: z.string().uuid('Selecione um plano.'),
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

  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      startDate: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  useEffect(() => {
    if (isOpen) {
      Promise.all([getServices(), getSubscriptionPlans()]).then(
        ([servicesRes, plansRes]) => {
          setServices(servicesRes.data || [])
          setPlans(plansRes.data || [])
        },
      )
    }
  }, [isOpen])

  const selectedServiceId = form.watch('serviceId')

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

  const onSubmit = async (values: SubscriptionFormValues) => {
    setIsSubmitting(true)
    const { error } = await createClientSubscription({
      client_id: clientId,
      service_id: values.serviceId,
      subscription_plan_id: values.planId,
      start_date: new Date(values.startDate).toISOString(),
      end_date: null,
      status: 'active',
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

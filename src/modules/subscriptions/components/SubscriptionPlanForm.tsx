import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { SubscriptionPlan } from '@/shared/types'

const planSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'O preço não pode ser negativo.'),
  sessions_per_week: z.coerce
    .number()
    .int()
    .min(1, 'Mínimo 1 sessão por semana.')
    .optional(),
})

type PlanFormValues = z.infer<typeof planSchema>

interface SubscriptionPlanFormProps {
  onSubmit: (values: any) => void
  defaultValues?: Partial<SubscriptionPlan>
  isSubmitting: boolean
  fixedServiceId: string
}

export const SubscriptionPlanForm = ({
  onSubmit,
  defaultValues,
  isSubmitting,
  fixedServiceId,
}: SubscriptionPlanFormProps) => {
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      description: defaultValues?.description || '',
      price: defaultValues?.price || 0,
      sessions_per_week: defaultValues?.sessions_per_week || 2,
    },
  })

  const handleSubmit = (values: PlanFormValues) => {
    onSubmit({
      ...values,
      service_id: fixedServiceId,
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Plano</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Pilates 2x/Semana Mensal" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Detalhes do plano..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preço Mensal (R$)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sessions_per_week"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sessões/Semana</FormLabel>
                <FormControl>
                  <Input type="number" min="1" {...field} />
                </FormControl>
                <FormDescription>Apenas informativo.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Salvando...' : 'Salvar Plano'}
        </Button>
      </form>
    </Form>
  )
}

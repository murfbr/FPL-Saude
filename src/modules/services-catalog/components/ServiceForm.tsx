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
import { Switch } from '@/components/ui/switch'
import { Service } from '@/shared/types'

const serviceSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  description: z.string().optional(),
  duration_minutes: z.coerce
    .number()
    .int()
    .positive('A duração deve ser um número positivo.'),
  price: z.coerce.number().min(0, 'O preço não pode ser negativo.'),
  max_attendees: z.coerce
    .number()
    .int()
    .positive('O número máximo de participantes deve ser pelo menos 1.')
    .default(1),
  requires_observation: z.boolean().default(true),
})

type ServiceFormValues = z.infer<typeof serviceSchema>

interface ServiceFormProps {
  onSubmit: (values: any) => void
  defaultValues?: Partial<Service>
  isSubmitting: boolean
}

export const ServiceForm = ({
  onSubmit,
  defaultValues,
  isSubmitting,
}: ServiceFormProps) => {
  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      description: defaultValues?.description || '',
      duration_minutes: defaultValues?.duration_minutes || 60,
      price: defaultValues?.price || 0,
      max_attendees: defaultValues?.max_attendees || 1,
      requires_observation: defaultValues?.requires_observation ?? true,
    },
  })

  // We automatically inject 'session' as value_type to satisfy the backend enum for now
  const handleSubmit = (values: ServiceFormValues) => {
    onSubmit({
      ...values,
      value_type: 'session',
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
              <FormLabel>Nome do Serviço</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Fisioterapia Ortopédica" {...field} />
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
                  placeholder="Descreva o serviço..."
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
            name="duration_minutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duração (minutos)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preço Avulso (R$)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormDescription>
                  Valor base cobrado por sessão avulsa.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="max_attendees"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max. Participantes</FormLabel>
              <FormControl>
                <Input type="number" min="1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="requires_observation"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  Requer Prontuário?
                </FormLabel>
                <FormDescription>
                  Se desativado, o profissional poderá finalizar o atendimento
                  sem preencher a evolução.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Salvando...' : 'Salvar Serviço'}
        </Button>
      </form>
    </Form>
  )
}

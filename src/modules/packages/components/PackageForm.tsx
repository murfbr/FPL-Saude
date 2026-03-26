import { useEffect, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Package, Service } from '@/shared/types'
import { getServices } from '@/shared/services'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

const packageSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  description: z.string().optional(),
  service_id: z.string().min(1, 'Selecione um serviço.'),
  session_count: z.coerce
    .number()
    .int()
    .positive('O número de sessões deve ser positivo.'),
  price: z.coerce.number().positive('O preço deve ser positivo.'),
})

type PackageFormValues = z.infer<typeof packageSchema>

interface PackageFormProps {
  onSubmit: (values: PackageFormValues) => void
  defaultValues?: Partial<Package>
  isSubmitting: boolean
  fixedServiceId?: string
}

export const PackageForm = ({
  onSubmit,
  defaultValues,
  isSubmitting,
  fixedServiceId,
}: PackageFormProps) => {
  const [services, setServices] = useState<Service[]>([])
  const [frequency, setFrequency] = useState<string>('custom')

  const form = useForm<PackageFormValues>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      description: defaultValues?.description || '',
      service_id: fixedServiceId || defaultValues?.service_id || '',
      session_count: defaultValues?.session_count || 1,
      price: defaultValues?.price || 0,
    },
  })

  useEffect(() => {
    getServices().then(({ data }) => {
      // Allow any service to have packages now
      setServices(data || [])
    })
  }, [])

  useEffect(() => {
    if (fixedServiceId) {
      form.setValue('service_id', fixedServiceId)
    }
  }, [fixedServiceId, form])

  // Helper to auto-calculate sessions based on frequency selection
  const handleFrequencyChange = (value: string) => {
    setFrequency(value)
    let sessions = 0
    // Assuming a standard month of 4 weeks
    switch (value) {
      case '1x':
        sessions = 4
        break
      case '2x':
        sessions = 8
        break
      case '3x':
        sessions = 12
        break
      case '4x':
        sessions = 16
        break
      default:
        return
    }
    if (sessions > 0) {
      form.setValue('session_count', sessions)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Pacote</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Pilates 10 Sessões" {...field} />
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
                  placeholder="Descreva o pacote..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="service_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Serviço Associado</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                value={field.value}
                disabled={!!fixedServiceId}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um serviço" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Frequency Helper */}
        <div className="space-y-3 p-4 bg-muted/20 rounded-md border">
          <FormLabel className="text-sm font-semibold">
            Sugestão de Frequência (Base Mensal)
          </FormLabel>
          <RadioGroup
            value={frequency}
            onValueChange={handleFrequencyChange}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="1x" id="freq-1x" />
              <FormLabel
                htmlFor="freq-1x"
                className="font-normal cursor-pointer"
              >
                1x/Semana (4)
              </FormLabel>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="2x" id="freq-2x" />
              <FormLabel
                htmlFor="freq-2x"
                className="font-normal cursor-pointer"
              >
                2x/Semana (8)
              </FormLabel>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="3x" id="freq-3x" />
              <FormLabel
                htmlFor="freq-3x"
                className="font-normal cursor-pointer"
              >
                3x/Semana (12)
              </FormLabel>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="freq-custom" />
              <FormLabel
                htmlFor="freq-custom"
                className="font-normal cursor-pointer"
              >
                Outro
              </FormLabel>
            </div>
          </RadioGroup>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="session_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantidade de Sessões</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e)
                      setFrequency('custom')
                    }}
                  />
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
                <FormLabel>Preço Total (R$)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" {...field} />
                </FormControl>
                <FormDescription>
                  Defina o valor total para o pacote.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Salvando...' : 'Salvar Pacote'}
        </Button>
      </form>
    </Form>
  )
}

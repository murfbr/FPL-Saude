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
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CalendarIcon, Loader2, PartyPopper, DollarSign, Building2, Clock } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/shared/hooks/use-toast'
import { Professional } from '@/shared/types'
import { getAllProfessionals } from '@/shared/services'
import { bookClinicEvent } from '@/modules/appointments/service'
import { useAuth } from '@/shared/providers/AuthProvider'
import { useInvalidateAppointments } from '@/modules/appointments/queries'

const eventSchema = z.object({
  title: z.string().min(2, 'Informe o título do evento.'),
  contractor: z.string().optional(),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'O valor deve ser zero ou positivo.'),
  durationMinutes: z.coerce.number().min(15, 'Duração mínima de 15 minutos.').max(1440, 'Duração máxima de 24 horas.'),
  professionalId: z.string().min(1, 'Selecione um profissional responsável.'),
  date: z.date({ required_error: 'Selecione uma data.' }),
  startTime: z.string().min(1, 'Informe o horário de início.'),
})

type EventFormValues = z.infer<typeof eventSchema>

interface EventFormDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onEventCreated: () => void
  initialDate?: Date
  preselectedProfessionalId?: string
}

export const EventFormDialog = ({
  isOpen,
  onOpenChange,
  onEventCreated,
  initialDate,
  preselectedProfessionalId,
}: EventFormDialogProps) => {
  const { toast } = useToast()
  const { loading, companyId } = useAuth()
  const invalidateAppointments = useInvalidateAppointments()
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [isLoadingProfessionals, setIsLoadingProfessionals] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      contractor: '',
      description: '',
      price: 0,
      durationMinutes: 60,
      professionalId: preselectedProfessionalId || '',
      date: initialDate || undefined,
      startTime: initialDate
        ? `${String(initialDate.getHours()).padStart(2, '0')}:${String(initialDate.getMinutes()).padStart(2, '0')}`
        : '',
    },
  })

  // Carregar profissionais ao abrir
  useEffect(() => {
    if (isOpen && !loading && companyId) {
      setIsLoadingProfessionals(true)
      getAllProfessionals({ activeOnly: true })
        .then(({ data }) => setProfessionals(data || []))
        .finally(() => setIsLoadingProfessionals(false))
    }

    if (!isOpen) {
      form.reset({
        title: '',
        contractor: '',
        description: '',
        price: 0,
        durationMinutes: 60,
        professionalId: preselectedProfessionalId || '',
        date: undefined,
        startTime: '',
      })
    }
  }, [isOpen, loading, companyId, preselectedProfessionalId, form])

  // Pré-preencher data e hora se vier do clique em slot
  useEffect(() => {
    if (isOpen && initialDate) {
      form.setValue('date', initialDate)
      const hh = String(initialDate.getHours()).padStart(2, '0')
      const mm = String(initialDate.getMinutes()).padStart(2, '0')
      form.setValue('startTime', `${hh}:${mm}`)
    }
  }, [isOpen, initialDate, form])

  const onSubmit = async (values: EventFormValues) => {
    setIsSubmitting(true)
    try {
      // Compor startTime ISO a partir da data + hora
      const [hours, minutes] = values.startTime.split(':').map(Number)
      const startDate = new Date(values.date)
      startDate.setHours(hours, minutes, 0, 0)

      const { error } = await bookClinicEvent({
        professionalId: values.professionalId,
        title: values.title,
        contractor: values.contractor || undefined,
        description: values.description || undefined,
        price: values.price,
        durationMinutes: values.durationMinutes,
        startTime: startDate.toISOString(),
      })

      if (error) {
        toast({ title: 'Erro ao criar evento', description: String(error), variant: 'destructive' })
      } else {
        toast({ title: 'Evento criado com sucesso!' })
        invalidateAppointments()
        onEventCreated()
        onOpenChange(false)
      }
    } catch (err: any) {
      toast({ title: 'Erro inesperado', description: String(err), variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-purple-500" />
            Novo Evento
          </DialogTitle>
          <DialogDescription>
            {initialDate
              ? `Evento para ${format(initialDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
              : 'Cadastre um evento especial na agenda.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Título */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título do Evento *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Workshop de Pilates, Imersão Mensal..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contratante */}
            <FormField
              control={form.control}
              name="contractor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    Empresa / Contratante
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Nome da empresa ou contratante (opcional)" {...field} />
                  </FormControl>
                  <FormDescription>
                    Aparecerá no lugar do serviço na visualização da agenda.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Descrição */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição / Detalhes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações, instruções, público-alvo, local..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Linha: Duração + Valor */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="durationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      Duração (min) *
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={15} max={1440} step={15} {...field} />
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
                    <FormLabel className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                      Valor (R$) *
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" placeholder="0,00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Profissional */}
            <FormField
              control={form.control}
              name="professionalId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profissional Responsável *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isLoadingProfessionals}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o profissional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {professionals.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Data */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground',
                          )}
                        >
                          {field.value ? (
                            format(field.value, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          ) : (
                            <span>Selecione uma data</span>
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
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Horário */}
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Horário de Início *</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <PartyPopper className="h-4 w-4 mr-2" />
                    Criar Evento
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

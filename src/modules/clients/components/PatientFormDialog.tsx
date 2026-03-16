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
import { Input } from '@/components/ui/input'
import { useToast } from '@/shared/hooks/use-toast'
import { Partnership, Client } from '@/shared/types'
import { createClient } from '@/shared/services'
import { getAllPartnerships } from '@/shared/services'
import { Skeleton } from '@/components/ui/skeleton'
import {
  cleanCPF,
  formatCPF,
  validateCPF,
  formatDateInput,
  isValidDate,
  convertDateToISO,
} from '@/shared/lib/utils'

const patientSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  email: z.string().refine((val) => validateCPF(val), {
    message: 'CPF inválido. Deve conter 11 dígitos numéricos.',
  }),
  phone: z.string().optional(),
  partnership_id: z.string().uuid().nullable().optional(),
  birth_date: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true
        return isValidDate(val)
      },
      { message: 'Data inválida ou futura (DD/MM/AAAA).' },
    ),
})

type PatientFormValues = z.infer<typeof patientSchema>

interface PatientFormDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onPatientCreated: (client: Client) => void
}

export const PatientFormDialog = ({
  isOpen,
  onOpenChange,
  onPatientCreated,
}: PatientFormDialogProps) => {
  const { toast } = useToast()
  const [partnerships, setPartnerships] = useState<Partnership[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      partnership_id: null,
      birth_date: '',
    },
  })

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      getAllPartnerships().then(({ data }) => {
        setPartnerships(data || [])
        setIsLoading(false)
      })
    }
  }, [isOpen])

  const onSubmit = async (values: PatientFormValues) => {
    setIsSubmitting(true)
    const cpfClean = cleanCPF(values.email)
    const { data, error } = await createClient({
      ...values,
      email: cpfClean,
      partnership_id: values.partnership_id || null,
      birth_date: convertDateToISO(values.birth_date),
    })

    if (error) {
      toast({
        title: 'Erro ao criar paciente',
        description: error.message.includes('duplicate key')
          ? 'Um paciente com este CPF já existe.'
          : error.message,
        variant: 'destructive',
      })
    } else if (data) {
      toast({ title: 'Paciente criado com sucesso!' })
      onPatientCreated(data)
      onOpenChange(false)
      form.reset()
    }
    setIsSubmitting(false)
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) form.reset()
        onOpenChange(open)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Paciente</DialogTitle>
          <DialogDescription>
            Preencha os dados para cadastrar um novo paciente.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do paciente" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="000.000.000-00"
                      {...field}
                      onChange={(e) => {
                        const formatted = formatCPF(e.target.value)
                        if (formatted.length <= 14) {
                          field.onChange(formatted)
                        }
                      }}
                      maxLength={14}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="birth_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Nascimento (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="DD/MM/AAAA"
                      {...field}
                      onChange={(e) =>
                        field.onChange(formatDateInput(e.target.value))
                      }
                      maxLength={10}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="(XX) XXXXX-XXXX" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="partnership_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parceria (Opcional)</FormLabel>
                  {isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === 'none' ? null : value)
                      }
                      defaultValue={field.value || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma parceria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {partnerships.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting || isLoading}>
                {isSubmitting ? 'Salvando...' : 'Salvar Paciente'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

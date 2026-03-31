import { useEffect, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { useToast } from '@/shared/hooks/use-toast'
import { Client } from '@/shared/types'
import { updateClient } from '@/shared/services'
import {
  cleanCPF,
  formatCPF,
  validateCPF,
  formatDateInput,
  isValidDate,
  convertDateToISO,
} from '@/shared/lib/utils'
import { uploadFile, getPublicUrl } from '@/shared/lib/storage'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Camera } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const patientSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  email: z.string().refine((val) => validateCPF(val), {
    message: 'CPF inválido. Deve conter 11 dígitos numéricos.',
  }),
  phone: z.string().optional(),
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

interface PatientEditDialogProps {
  patient: Client | null
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onPatientUpdated: (updatedPatient: Client) => void
}

export const PatientEditDialog = ({
  patient,
  isOpen,
  onOpenChange,
  onPatientUpdated,
}: PatientEditDialogProps) => {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
  })

  useEffect(() => {
    if (patient) {
      form.reset({
        name: patient.name,
        email: formatCPF(patient.email),
        phone: patient.phone || '',
        birth_date: patient.birth_date
          ? format(parseISO(patient.birth_date), 'dd/MM/yyyy')
          : '',
      })
      setPreviewUrl(patient.profile_picture_url || null)
      setAvatarFile(null)
    }
  }, [patient, form, isOpen])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const onSubmit = async (values: PatientFormValues) => {
    if (!patient) return
    setIsSubmitting(true)

    let profile_picture_url = patient.profile_picture_url || null

    if (avatarFile) {
      const filePath = `patients/${patient.id}/${Date.now()}-${avatarFile.name}`
      const { error: uploadError } = await uploadFile(
        'avatars',
        filePath,
        avatarFile,
      )

      if (uploadError) {
        toast({
          title: 'Erro no upload da foto',
          description: uploadError.message,
          variant: 'destructive',
        })
        setIsSubmitting(false)
        return
      }
      profile_picture_url = getPublicUrl('avatars', filePath)
    }

    const cpfClean = cleanCPF(values.email)

    const { data, error } = await updateClient(patient.id, {
      name: values.name,
      phone: values.phone || null,
      email: cpfClean,
      profile_picture_url,
      birth_date: convertDateToISO(values.birth_date),
    })

    if (error) {
      toast({
        title: 'Erro ao atualizar paciente',
        description: error.message,
        variant: 'destructive',
      })
    } else if (data) {
      toast({ title: 'Paciente atualizado com sucesso!' })
      onPatientUpdated(data)
      onOpenChange(false)
    }
    setIsSubmitting(false)
  }

  if (!patient) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Paciente</DialogTitle>
          <DialogDescription>
            Atualize as informações de {patient.name}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 py-4"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={previewUrl || ''} objectFit="cover" />
                  <AvatarFallback className="text-2xl">
                    {patient.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <label
                  htmlFor="picture-upload"
                  className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full cursor-pointer hover:bg-primary/90 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  <input
                    id="picture-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

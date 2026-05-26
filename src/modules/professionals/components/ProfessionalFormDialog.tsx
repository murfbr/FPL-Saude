import { useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/shared/hooks/use-toast'
import { createProfessionalUser } from '@/shared/services'
import { Loader2 } from 'lucide-react'
import { getFriendlyErrorMessage } from '@/shared/lib/error-mapping'

const professionalSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  email: z.string().email('Por favor, insira um email válido.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.').optional().or(z.literal('')),
  specialty: z.string().optional(),
  bio: z.string().optional(),
  avatar_url: z
    .string()
    .url('Insira uma URL válida.')
    .optional()
    .or(z.literal('')),
})

type ProfessionalFormValues = z.infer<typeof professionalSchema>

interface ProfessionalFormDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onProfessionalCreated: () => void
}

export const ProfessionalFormDialog = ({
  isOpen,
  onOpenChange,
  onProfessionalCreated,
}: ProfessionalFormDialogProps) => {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ProfessionalFormValues>({
    resolver: zodResolver(professionalSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      specialty: '',
      bio: '',
      avatar_url: '',
    },
  })

  const onSubmit = async (values: ProfessionalFormValues) => {
    setIsSubmitting(true)
    const { error } = await createProfessionalUser(values)

    if (error) {
      // Use friendly error mapping here
      const friendlyMessage = getFriendlyErrorMessage(error)

      // Specifically helpful for email duplication
      if (friendlyMessage.includes('e-mail já está em uso')) {
        form.setError('email', { message: friendlyMessage })
      }

      toast({
        title: 'Erro ao criar profissional',
        description: friendlyMessage,
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Profissional criado com sucesso!' })
      onProfessionalCreated()
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Profissional</DialogTitle>
          <DialogDescription>
            Crie um novo perfil de profissional e uma conta de usuário
            associada.
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
                    <Input placeholder="Nome do profissional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de Login</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha Inicial (Opcional)</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Se vazio, envia convite" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="specialty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Especialidade</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Fisioterapeuta" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Biografia</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Breve descrição sobre o profissional..."
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
              name="avatar_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL do Avatar (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Profissional'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

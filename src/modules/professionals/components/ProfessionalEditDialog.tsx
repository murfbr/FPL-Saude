import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useNavigate } from 'react-router-dom'
import { Professional } from '@/shared/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/shared/hooks/use-toast'
import { updateProfessional } from '@/shared/services'
import { uploadFile, getPublicUrl } from '@/shared/lib/storage'
import { useAuth } from '@/shared/providers/AuthProvider'
import { Ban, CheckCircle, Loader2 } from 'lucide-react'

const professionalSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres.'),
  specialty: z.string().optional(),
  bio: z.string().optional(),
  is_active: z.boolean().default(true),
})

type ProfessionalFormValues = z.infer<typeof professionalSchema>

interface ProfessionalEditDialogProps {
  professional: Professional
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onProfessionalUpdate: (updatedProfessional: Professional) => void
}

export const ProfessionalEditDialog = ({
  professional,
  isOpen,
  onOpenChange,
  onProfessionalUpdate,
}: ProfessionalEditDialogProps) => {
  const { toast } = useToast()
  const { role } = useAuth()
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isProcessingStatus, setIsProcessingStatus] = useState(false)
  const [showInactivateAlert, setShowInactivateAlert] = useState(false)

  const isAdmin = role === 'admin'

  const form = useForm<ProfessionalFormValues>({
    resolver: zodResolver(professionalSchema),
    values: {
      name: professional.name,
      specialty: professional.specialty || '',
      bio: professional.bio || '',
      is_active: professional.is_active ?? true,
    },
  })

  const onSubmit = async (values: ProfessionalFormValues) => {
    setIsSubmitting(true)
    let avatar_url = professional.avatar_url

    if (avatarFile) {
      const filePath = `avatars/${professional.id}/${avatarFile.name}`
      const { error: uploadError } = await uploadFile(
        'avatars',
        filePath,
        avatarFile,
      )
      if (uploadError) {
        toast({ title: 'Erro no upload do avatar', variant: 'destructive' })
        setIsSubmitting(false)
        return
      }
      avatar_url = getPublicUrl('avatars', filePath)
    }

    const { data, error } = await updateProfessional(professional.id, {
      ...values,
      avatar_url,
    })

    if (error) {
      toast({ title: 'Erro ao atualizar perfil', variant: 'destructive' })
    } else if (data) {
      toast({ title: 'Perfil atualizado com sucesso!' })
      onProfessionalUpdate(data)
      onOpenChange(false)
    }
    setIsSubmitting(false)
  }

  const handleToggleStatus = async () => {
    setIsProcessingStatus(true)
    const newStatus = !professional.is_active

    const { data, error } = await updateProfessional(professional.id, {
      is_active: newStatus,
    })

    if (error) {
      toast({
        title: `Erro ao ${newStatus ? 'ativar' : 'inativar'} profissional`,
        description: error.message,
        variant: 'destructive',
      })
    } else if (data) {
      toast({
        title: `Profissional ${newStatus ? 'ativado' : 'inativado'} com sucesso`,
        description: newStatus
          ? 'O profissional agora tem acesso ao sistema.'
          : 'O profissional não aparecerá para novos agendamentos.',
      })
      onProfessionalUpdate(data)
      setShowInactivateAlert(false)
      onOpenChange(false)
    }
    setIsProcessingStatus(false)
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Perfil do Profissional</DialogTitle>
            <DialogDescription>
              Atualize as informações de {professional.name}.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="specialty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialidade</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Textarea {...field} className="resize-none" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Foto de Perfil</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setAvatarFile(e.target.files ? e.target.files[0] : null)
                    }
                  />
                </FormControl>
              </FormItem>

              {isAdmin && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-muted/20">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Status da Conta
                        </FormLabel>
                        <FormDescription>
                          {professional.is_active
                            ? 'Profissional ativo e visível para agendamentos.'
                            : 'Profissional inativo. Histórico preservado.'}
                        </FormDescription>
                      </div>
                      <div className="flex items-center">
                        {professional.is_active ? (
                          <Badge variant="default" className="bg-green-600">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Inativo</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        variant={
                          professional.is_active ? 'destructive' : 'outline'
                        }
                        size="sm"
                        onClick={() => setShowInactivateAlert(true)}
                        className={
                          !professional.is_active
                            ? 'border-green-600 text-green-600 hover:text-green-700 hover:bg-green-50'
                            : ''
                        }
                      >
                        {professional.is_active ? (
                          <>
                            <Ban className="mr-2 h-4 w-4" />
                            Inativar Profissional
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Reativar Profissional
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={showInactivateAlert}
        onOpenChange={setShowInactivateAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {professional.is_active ? (
                <>
                  <Ban className="h-5 w-5 text-destructive" />
                  <span className="text-destructive">
                    Inativar Profissional
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-600">Reativar Profissional</span>
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              {professional.is_active ? (
                <>
                  <p>
                    Tem certeza que deseja inativar{' '}
                    <span className="font-semibold text-foreground">
                      {professional.name}
                    </span>
                    ?
                  </p>
                  <p>Isso fará com que:</p>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    <li>
                      O profissional não aparecerá para novos agendamentos.
                    </li>
                    <li>O acesso ao sistema será revogado.</li>
                    <li>
                      Todo o histórico de agendamentos e financeiro{' '}
                      <span className="font-bold">será preservado</span>.
                    </li>
                  </ul>
                </>
              ) : (
                <>
                  <p>
                    Tem certeza que deseja reativar{' '}
                    <span className="font-semibold text-foreground">
                      {professional.name}
                    </span>
                    ?
                  </p>
                  <p>
                    O profissional voltará a aparecer na lista e poderá receber
                    novos agendamentos.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessingStatus}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleToggleStatus()
              }}
              className={
                professional.is_active
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }
              disabled={isProcessingStatus}
            >
              {isProcessingStatus ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : professional.is_active ? (
                'Sim, inativar'
              ) : (
                'Sim, reativar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

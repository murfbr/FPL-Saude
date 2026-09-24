import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Paperclip, X, ExternalLink } from 'lucide-react'
import { Expense, ExpenseAttachment } from '@/shared/types'
import {
  createExpense,
  updateExpense,
  createExpenseCategory,
  uploadExpenseAttachment,
  removeExpenseAttachment,
} from '@/modules/financial/service'
import {
  useExpenseCategories,
  useSuppliers,
  useInvalidateFinancial,
} from '@/modules/financial/queries'
import { useAuth } from '@/shared/providers/AuthProvider'
import { useToast } from '@/shared/hooks/use-toast'

const PAYMENT_METHODS = [
  'Pix',
  'Dinheiro',
  'Cartão de Débito',
  'Cartão de Crédito',
  'Boleto',
  'Transferência',
  'Outro',
]

const NEW_CATEGORY = '__nova__'

const expenseSchema = z.object({
  description: z.string().min(2, 'Descreva a despesa'),
  amount: z.coerce.number().positive('Informe um valor maior que zero'),
  categoryId: z.string().min(1, 'Escolha a categoria'),
  newCategoryName: z.string().optional(),
  supplierName: z.string().optional(),
  dueDate: z.string().min(10, 'Informe o vencimento'),
  isRecurring: z.boolean(),
  paidNow: z.boolean(),
  paymentMethod: z.string().optional(),
})

type ExpenseFormValues = z.infer<typeof expenseSchema>

interface ExpenseFormDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** Despesa em edição; undefined = nova */
  expense?: Expense | null
}

export const ExpenseFormDialog = ({
  isOpen,
  onOpenChange,
  expense,
}: ExpenseFormDialogProps) => {
  const { toast } = useToast()
  const { professionalId, user } = useAuth()
  const invalidateFinancial = useInvalidateFinancial()
  const { data: categories = [] } = useExpenseCategories()
  const { data: suppliers = [] } = useSuppliers()
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Arquivos escolhidos agora, enviados após salvar (a despesa precisa de ID)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [removingPath, setRemovingPath] = useState<string | null>(null)

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: '',
      amount: 0,
      categoryId: '',
      supplierName: '',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      isRecurring: false,
      paidNow: false,
      paymentMethod: '',
    },
  })

  useEffect(() => {
    if (!isOpen) return
    setPendingFiles([])
    if (expense) {
      form.reset({
        description: expense.description,
        amount: expense.amount,
        categoryId: expense.category_id || '',
        supplierName: expense.supplier_name || '',
        dueDate: expense.due_date,
        isRecurring: expense.is_recurring,
        paidNow: false,
        paymentMethod: expense.payment_method || '',
      })
    } else {
      form.reset({
        description: '',
        amount: 0,
        categoryId: '',
        supplierName: '',
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        isRecurring: false,
        paidNow: false,
        paymentMethod: '',
      })
    }
  }, [isOpen, expense, form])

  const categoryId = form.watch('categoryId')
  const paidNow = form.watch('paidNow')

  const handleRemoveAttachment = async (att: ExpenseAttachment) => {
    if (!expense) return
    setRemovingPath(att.path)
    const { error } = await removeExpenseAttachment(expense.id, att)
    if (error) {
      toast({
        title: 'Erro ao remover anexo',
        description: (error as Error)?.message,
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Anexo removido' })
      invalidateFinancial()
    }
    setRemovingPath(null)
  }

  const onSubmit = async (values: ExpenseFormValues) => {
    setIsSubmitting(true)
    try {
      let finalCategoryId = values.categoryId
      let finalCategoryName =
        categories.find((c) => c.id === values.categoryId)?.name || null

      if (values.categoryId === NEW_CATEGORY) {
        const name = (values.newCategoryName || '').trim()
        if (!name) {
          form.setError('newCategoryName', {
            message: 'Dê um nome à categoria',
          })
          setIsSubmitting(false)
          return
        }
        const { data: cat, error } = await createExpenseCategory(name)
        if (error || !cat) throw error || new Error('Falha ao criar categoria')
        finalCategoryId = cat.id
        finalCategoryName = cat.name
      }

      const payload = {
        description: values.description,
        amount: values.amount,
        category_id: finalCategoryId,
        category_name: finalCategoryName,
        supplier_name: values.supplierName || null,
        due_date: values.dueDate,
        is_recurring: values.isRecurring,
        payment_method: values.paymentMethod || null,
      }

      let expenseId = expense?.id
      if (expense) {
        const { error } = await updateExpense(expense.id, payload)
        if (error) throw error
      } else {
        const { data: created, error } = await createExpense(
          { ...payload, paid_now: values.paidNow },
          professionalId || user?.id,
        )
        if (error || !created) throw error || new Error('Falha ao criar')
        expenseId = created.id
      }

      // Anexos: enviados um a um; falha em anexo não desfaz a despesa salva
      let failedUploads = 0
      if (expenseId) {
        for (const file of pendingFiles) {
          const { error } = await uploadExpenseAttachment(expenseId, file)
          if (error) {
            failedUploads++
            toast({
              title: `Anexo "${file.name}" não enviado`,
              description: (error as Error)?.message,
              variant: 'destructive',
            })
          }
        }
      }

      toast({
        title: expense
          ? 'Despesa atualizada'
          : values.paidNow
            ? 'Despesa registrada como paga'
            : 'Despesa registrada',
        description:
          pendingFiles.length > 0 && failedUploads === 0
            ? `${pendingFiles.length} anexo(s) enviado(s).`
            : undefined,
      })

      invalidateFinancial()
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'Erro ao salvar despesa',
        description: (err as Error)?.message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {expense ? 'Editar Despesa' : 'Nova Despesa'}
          </DialogTitle>
          <DialogDescription>
            {expense
              ? 'Altere os dados da despesa.'
              : 'Registre uma saída do caixa da clínica.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex.: Aluguel da sala"
              {...form.register('description')}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                {...form.register('amount')}
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Vencimento</Label>
              <Input id="dueDate" type="date" {...form.register('dueDate')} />
              {form.formState.errors.dueDate && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.dueDate.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={categoryId}
              onValueChange={(v) =>
                form.setValue('categoryId', v, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_CATEGORY}>+ Nova categoria…</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.categoryId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.categoryId.message}
              </p>
            )}
            {categoryId === NEW_CATEGORY && (
              <>
                <Input
                  placeholder="Nome da nova categoria"
                  {...form.register('newCategoryName')}
                />
                {form.formState.errors.newCategoryName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.newCategoryName.message}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplierName">Fornecedor (opcional)</Label>
            <Input
              id="supplierName"
              list="expense-suppliers"
              placeholder="Digite ou escolha um já usado"
              {...form.register('supplierName')}
            />
            <datalist id="expense-suppliers">
              {suppliers.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <Label>Comprovantes e boletos (opcional)</Label>
            {expense && (expense.attachments || []).length > 0 && (
              <div className="space-y-1">
                {(expense.attachments || []).map((att) => (
                  <div
                    key={att.path}
                    className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                  >
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 hover:underline truncate"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{att.name}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleRemoveAttachment(att)}
                      disabled={removingPath === att.path}
                    >
                      {removingPath === att.path ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {pendingFiles.length > 0 && (
              <div className="space-y-1">
                {pendingFiles.map((f, i) => (
                  <div
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between rounded-md border border-dashed px-3 py-1.5 text-sm"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        (envia ao salvar)
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() =>
                        setPendingFiles((prev) =>
                          prev.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
              multiple
              className="cursor-pointer"
              onChange={(ev) => {
                const files = Array.from(ev.target.files || [])
                if (files.length > 0)
                  setPendingFiles((prev) => [...prev, ...files])
                ev.target.value = ''
              }}
            />
            <p className="text-xs text-muted-foreground">
              PDF ou imagem, até 10 MB por arquivo.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={form.watch('isRecurring')}
                onCheckedChange={(v) =>
                  form.setValue('isRecurring', v === true)
                }
              />
              Despesa fixa mensal
            </label>
            {!expense && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={paidNow}
                  onCheckedChange={(v) => form.setValue('paidNow', v === true)}
                />
                Já está paga
              </label>
            )}
          </div>

          {paidNow && (
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select
                value={form.watch('paymentMethod') || ''}
                onValueChange={(v) => form.setValue('paymentMethod', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Como foi paga?" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

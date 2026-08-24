import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Repeat,
} from 'lucide-react'
import { format } from 'date-fns'
import { Expense } from '@/shared/types'
import {
  payExpense,
  unpayExpense,
  deleteExpense,
} from '@/modules/financial/service'
import {
  useExpenses,
  useInvalidateFinancial,
} from '@/modules/financial/queries'
import { useToast } from '@/shared/hooks/use-toast'
import { ExpenseFormDialog } from './ExpenseFormDialog'

const formatCurrency = (val: number | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    val || 0,
  )

const formatDay = (dateOnly: string) => {
  const [y, m, d] = dateOnly.split('-')
  return `${d}/${m}/${y}`
}

export const ExpensesTab = ({ month }: { month: Date }) => {
  const { toast } = useToast()
  const invalidateFinancial = useInvalidateFinancial()
  const { data: expenses = [], isLoading } = useExpenses(month)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)

  const todayKey = format(new Date(), 'yyyy-MM-dd')

  const { pendingTotal, paidTotal } = useMemo(() => {
    let pending = 0
    let paid = 0
    for (const e of expenses) {
      if (e.status === 'paid') paid += e.amount
      else pending += e.amount
    }
    return { pendingTotal: pending, paidTotal: paid }
  }, [expenses])

  const run = async (
    id: string,
    action: () => Promise<{ error: any }>,
    successTitle: string,
  ) => {
    setIsProcessing(id)
    const { error } = await action()
    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({ title: successTitle })
      invalidateFinancial()
    }
    setIsProcessing(null)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              A Pagar no mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(pendingTotal)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pago no mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(paidTotal)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null)
            setIsFormOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nova Despesa
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : expenses.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-md">
          Nenhuma despesa neste mês. Registre a primeira em “Nova Despesa”.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => {
                const overdue = e.status === 'pending' && e.due_date < todayKey
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {e.description}
                        {e.is_recurring && (
                          <Repeat
                            className="h-3 w-3 text-muted-foreground"
                            aria-label="Despesa fixa mensal"
                          />
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{e.category_name || '—'}</TableCell>
                    <TableCell>{e.supplier_name || '—'}</TableCell>
                    <TableCell>{formatDay(e.due_date)}</TableCell>
                    <TableCell>{formatCurrency(e.amount)}</TableCell>
                    <TableCell>
                      {e.status === 'paid' ? (
                        <Badge className="bg-green-500 hover:bg-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" /> Paga
                        </Badge>
                      ) : overdue ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Vencida
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-orange-100 text-orange-800 hover:bg-orange-200"
                        >
                          A pagar
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        {e.status === 'pending' ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                              >
                                Pagar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Confirmar pagamento
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Marcar <strong>{e.description}</strong> (
                                  {formatCurrency(e.amount)}) como paga hoje? O
                                  valor entra nas saídas do Fluxo de Caixa deste
                                  mês.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    run(
                                      e.id,
                                      () => payExpense(e.id),
                                      'Despesa paga',
                                    )
                                  }
                                  disabled={isProcessing === e.id}
                                >
                                  {isProcessing === e.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    'Confirmar'
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8"
                              >
                                <RotateCcw className="mr-2 h-4 w-4" /> Desfazer
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Desfazer pagamento
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  A despesa volta para “A pagar” e sai das
                                  saídas do mês.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    run(
                                      e.id,
                                      () => unpayExpense(e.id),
                                      'Pagamento desfeito',
                                    )
                                  }
                                  disabled={isProcessing === e.id}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {isProcessing === e.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    'Desfazer'
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => {
                                setEditing(e)
                                setIsFormOpen(true)
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  onSelect={(ev) => ev.preventDefault()}
                                  className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Excluir despesa
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Excluir <strong>{e.description}</strong>?{' '}
                                    {e.status === 'paid'
                                      ? 'O valor pago sai das saídas do mês.'
                                      : 'A pendência deixa de existir.'}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    Cancelar
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      run(
                                        e.id,
                                        () => deleteExpense(e.id),
                                        'Despesa excluída',
                                      )
                                    }
                                    disabled={isProcessing === e.id}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {isProcessing === e.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      'Excluir'
                                    )}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ExpenseFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        expense={editing}
      />
    </div>
  )
}

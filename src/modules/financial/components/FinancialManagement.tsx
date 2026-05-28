import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  paySubscription,
  deleteSubscriptionPayment,
} from '@/shared/services'
import { cancelClientSubscription } from '@/modules/clients/services/subscriptions'
import { ClientSubscription } from '@/shared/types'
import { useAuth } from '@/shared/providers/AuthProvider'
import { useToast } from '@/shared/hooks/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import {
  format,
  addMonths,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Loader2,
  RotateCcw,
  MoreHorizontal,
  User,
  Ban,
} from 'lucide-react'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PackageFinancials } from './PackageFinancials'
import { ReceiptsTab } from './ReceiptsTab'
import {
  useMonthlySummary,
  useActiveSubscriptions,
  useSubscriptionPayments,
  useInvalidateFinancial,
} from '@/modules/financial/queries'

// Mirrors proration logic from paySubscription service
const calculateSubscriptionAmount = (sub: ClientSubscription, forMonth: Date): number => {
  const fullPrice = sub.amount || sub.subscription_plans?.price || sub.services?.price || 0
  if (!sub.start_date) return fullPrice

  const startDate = new Date(sub.start_date)
  const isSameMonthAsStart =
    startDate.getFullYear() === forMonth.getFullYear() &&
    startDate.getMonth() === forMonth.getMonth()

  if (isSameMonthAsStart) {
    const daysInMonth = new Date(forMonth.getFullYear(), forMonth.getMonth() + 1, 0).getDate()
    const daysActive = daysInMonth - startDate.getDate() + 1
    return Math.round((fullPrice / daysInMonth) * daysActive * 100) / 100
  }
  return fullPrice
}

export const FinancialManagement = () => {
  const { professionalId, user, role } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const invalidateFinancial = useInvalidateFinancial()

  // TanStack Query: cache de summary (10min), subscriptions (5min), payments (5min)
  const { data: summary, isLoading: summaryLoading } = useMonthlySummary(currentDate)
  const { data: subs = [], isLoading: subsLoading } = useActiveSubscriptions({ limit: 50, targetDate: currentDate })

  const subIds = useMemo(() => subs.map((s) => s.id), [subs])
  const { data: payments = [] } = useSubscriptionPayments(subIds, currentDate)

  // Enriquecer subscriptions com status de pagamento (computado, 0 reads)
  const subscriptions = useMemo(() => {
    if (subs.length === 0) return []

    const paidSubMap = new Map<string, string>()
    payments.forEach((p: any) => {
      paidSubMap.set(p.client_subscription_id, p.id)
    })

    return subs.map((sub) => {
      const paymentId = paidSubMap.get(sub.id)
      let status: 'paid' | 'overdue' | 'pending' | 'cancelled' = 'pending'

      if (paymentId) {
        status = 'paid'
      } else {
        const today = new Date()
        const viewMonth = currentDate.getMonth()
        const viewYear = currentDate.getFullYear()
        const currentMonth = today.getMonth()
        const currentYear = today.getFullYear()

        if (
          viewYear < currentYear ||
          (viewYear === currentYear && viewMonth < currentMonth)
        ) {
          status = 'overdue'
        } else if (viewYear === currentYear && viewMonth === currentMonth) {
          if (today.getDate() > 5) {
            status = 'overdue'
          }
        }
        
        // Se a assinatura internamente está cancelada, ou se ela terminou neste mês ou antes (end_date),
        // e ainda não foi paga (estamos no bloco else), marcamos como 'cancelled' 
        // para não gerar sensação de falsa pendência/valor dobrado.
        const viewEndStr = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString()
        const tEnd = sub.end_date || sub.cancelled_at
        const endedThisMonthOrBefore = tEnd && tEnd <= viewEndStr

        if (sub.status === 'cancelled' || endedThisMonthOrBefore) {
          status = 'cancelled'
        }
      }

      return {
        ...sub,
        payment_status: status,
        financial_record_id: paymentId,
      }
    })
  }, [subs, payments, currentDate])

  // Receita prevista calculada client-side (0 reads) usando `subscriptions` que já tem o status computado
  const expectedSubsRevenue = useMemo(() => {
    return subscriptions.reduce((acc, sub) => {
      // Se a assinatura foi cancelada E não foi paga, não entra na previsão de receita nem é considerada devida
      if (sub.payment_status === 'cancelled') return acc
      return acc + calculateSubscriptionAmount(sub, currentDate)
    }, 0)
  }, [subscriptions, currentDate])

  const isLoading = summaryLoading || subsLoading

  const handlePay = async (sub: ClientSubscription) => {
    // Use professionalId if available, otherwise fall back to the logged-in user's id
    const actorId = professionalId || user?.id
    if (!actorId) {
      toast({ title: 'Erro', description: 'Usuário não identificado.', variant: 'destructive' })
      return
    }
    setIsProcessing(sub.id)

    const { error } = await paySubscription(sub, actorId)

    if (error) {
      toast({
        title: 'Erro ao processar pagamento',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Pagamento Confirmado',
        description: `Mensalidade de ${sub.clients?.name} registrada com sucesso.`,
      })
      invalidateFinancial()
    }
    setIsProcessing(null)
  }

  const handleReverse = async (
    sub: ClientSubscription & { financial_record_id?: string },
  ) => {
    if (!sub.financial_record_id) return
    setIsProcessing(sub.id)


    const { error } = await deleteSubscriptionPayment(sub.financial_record_id)

    if (error) {
      toast({
        title: 'Erro ao estornar pagamento',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Estorno Realizado',
        description: `Pagamento de ${sub.clients?.name} foi removido.`,
      })
      invalidateFinancial()
    }
    setIsProcessing(null)
  }

  const handleCancelSub = async (sub: ClientSubscription) => {
    setIsProcessing(sub.id)
    const { error } = await cancelClientSubscription(sub.clients?.id as string, sub.id)

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Sucesso', description: 'Assinatura cancelada com sucesso.' })
      invalidateFinancial()
    }
    setIsProcessing(null)
  }

  const handlePrevMonth = () => setCurrentDate((prev) => subMonths(prev, 1))
  const handleNextMonth = () => setCurrentDate((prev) => addMonths(prev, 1))

  const formatCurrency = (val: number | undefined) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0)



  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Gestão Financeira</h2>
        <div className="flex items-center gap-2 bg-muted p-1 rounded-md">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-32 text-center font-medium capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Receita Prevista (Assinaturas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(expectedSubsRevenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{subscriptions.length} assinatura(s) ativa(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recebido (Total)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary?.total_revenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Avulsas + Assinaturas + Pacotes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pendente (Assinaturas)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(
                Math.max(0, expectedSubsRevenue - (summary?.subscriptions_revenue_received || 0))
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Receita prevista − Assinaturas pagas</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="subscriptions" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="subscriptions">Assinaturas Mensais</TabsTrigger>
          <TabsTrigger value="packages">Gestão de Pacotes</TabsTrigger>
          <TabsTrigger value="receipts">Emissão de Recibos</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle>Assinaturas Ativas</CardTitle>
              <CardDescription>
                Controle de pagamentos mensais para o período selecionado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : subscriptions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhuma assinatura ativa encontrada.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Plano/Serviço</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">
                          {sub.clients?.name}
                        </TableCell>
                        <TableCell>
                          {sub.subscription_plans?.name || sub.services?.name}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(
                            sub.amount || sub.subscription_plans?.price ||
                              sub.services?.price,
                          )}
                        </TableCell>
                        <TableCell>
                          {sub.payment_status === 'paid' ? (
                            <Badge className="bg-green-500 hover:bg-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Pago
                            </Badge>
                          ) : sub.payment_status === 'overdue' ? (
                            <Badge variant="destructive">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Em Atraso
                            </Badge>
                          ) : sub.payment_status === 'cancelled' ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              <Ban className="w-3 h-3 mr-1" />
                              Cancelada
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="bg-orange-100 text-orange-800 hover:bg-orange-200"
                            >
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-2">
                            {sub.payment_status === 'paid' ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8">
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Estornar
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar Estorno</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Deseja desfazer o pagamento de <strong>{sub.clients?.name}</strong>? O status voltará para pendente.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleReverse(sub)}
                                      disabled={isProcessing === sub.id}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      {isProcessing === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Estorno'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : sub.payment_status !== 'cancelled' && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="h-8">
                                    <DollarSign className="mr-2 h-4 w-4" />
                                    Quitar
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar Pagamento</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Deseja marcar a mensalidade de <strong>{sub.clients?.name}</strong> como paga referente a {format(currentDate, 'MMMM/yyyy', { locale: ptBR })}?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handlePay(sub)}
                                      disabled={isProcessing === sub.id}
                                    >
                                      {isProcessing === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
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
                                  onClick={() => navigate(role === 'admin' ? `/admin/pacientes/${sub.clients?.id}` : `/profissional/pacientes/${sub.clients?.id}`)}
                                  className="cursor-pointer"
                                >
                                  <User className="mr-2 h-4 w-4" />
                                  <span>Ver Perfil do Cliente</span>
                                </DropdownMenuItem>

                                {sub.status === 'active' && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <button className="w-full flex items-center px-2 py-1.5 text-sm cursor-pointer text-red-600 focus:bg-red-50 hover:bg-red-50 hover:text-red-700 outline-none rounded-sm">
                                            <Ban className="mr-2 h-4 w-4" />
                                            <span>Cancelar Assinatura</span>
                                          </button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Cancelar Assinatura Definitivamente</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Tem certeza que deseja cancelar a assinatura de <strong>{sub.clients?.name}</strong>? Esta ação interromperá cobranças futuras.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Manter Assinatura</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => handleCancelSub(sub)}
                                              disabled={isProcessing === sub.id}
                                              className="bg-red-600 hover:bg-red-700"
                                            >
                                              {isProcessing === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sim, Cancelar'}
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packages">
          <Card>
            <CardContent className="pt-6">
              <PackageFinancials />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts">
          <ReceiptsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

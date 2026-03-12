import { useState, useEffect } from 'react'
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
  getActiveSubscriptions,
  getSubscriptionPayments,
  paySubscription,
  deleteSubscriptionPayment,
} from '@/services'
import { ClientSubscription } from '@/types'
import { useAuth } from '@/providers/AuthProvider'
import { useToast } from '@/hooks/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PackageFinancials } from './PackageFinancials'

export const FinancialManagement = () => {
  const { professionalId, user } = useAuth()
  const { toast } = useToast()
  const [subscriptions, setSubscriptions] = useState<
    (ClientSubscription & { financial_record_id?: string })[]
  >([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)

  const fetchData = async () => {
    setIsLoading(true)
    const { data: subs, error } = await getActiveSubscriptions()

    if (error || !subs) {
      toast({
        title: 'Erro ao carregar dados',
        variant: 'destructive',
      })
      setIsLoading(false)
      return
    }

    const subIds = subs.map((s) => s.id)
    if (subIds.length > 0) {
      const { data: payments } = await getSubscriptionPayments(
        subIds,
        currentDate,
      )
      // Map subscription ID to financial record ID
      const paidSubMap = new Map<string, string>()
      payments?.forEach((p) => {
        paidSubMap.set(p.client_subscription_id, p.id)
      })

      const enrichedSubs = subs.map((sub) => {
        const paymentId = paidSubMap.get(sub.id)
        let status: 'paid' | 'overdue' | 'pending' = 'pending'

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
        }

        return {
          ...sub,
          payment_status: status,
          financial_record_id: paymentId,
        }
      })

      setSubscriptions(enrichedSubs)
    } else {
      setSubscriptions([])
    }

    setIsLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [currentDate])

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
      fetchData()
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
      fetchData()
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
              {formatCurrency(
                subscriptions.reduce(
                  (acc, sub) =>
                    acc +
                    (sub.subscription_plans?.price || sub.services?.price || 0),
                  0,
                ),
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recebido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(
                subscriptions
                  .filter((s) => s.payment_status === 'paid')
                  .reduce(
                    (acc, sub) =>
                      acc +
                      (sub.subscription_plans?.price ||
                        sub.services?.price ||
                        0),
                    0,
                  ),
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pendente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(
                subscriptions
                  .filter((s) => s.payment_status !== 'paid')
                  .reduce(
                    (acc, sub) =>
                      acc +
                      (sub.subscription_plans?.price ||
                        sub.services?.price ||
                        0),
                    0,
                  ),
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="subscriptions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="subscriptions">Assinaturas Mensais</TabsTrigger>
          <TabsTrigger value="packages">Gestão de Pacotes</TabsTrigger>
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
                            sub.subscription_plans?.price ||
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
                          {sub.payment_status === 'paid' ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <RotateCcw className="w-4 h-4 mr-2" />
                                  Estornar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Confirmar Estorno
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Deseja desfazer o pagamento de{' '}
                                    <strong>{sub.clients?.name}</strong>? O
                                    status voltará para pendente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    Cancelar
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleReverse(sub)}
                                    disabled={isProcessing === sub.id}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    {isProcessing === sub.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      'Confirmar Estorno'
                                    )}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <DollarSign className="w-4 h-4 mr-2" />
                                  Quitar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Confirmar Pagamento
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Deseja marcar a mensalidade de{' '}
                                    <strong>{sub.clients?.name}</strong> como
                                    paga referente a{' '}
                                    {format(currentDate, 'MMMM/yyyy', {
                                      locale: ptBR,
                                    })}
                                    ?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    Cancelar
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handlePay(sub)}
                                    disabled={isProcessing === sub.id}
                                  >
                                    {isProcessing === sub.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      'Confirmar'
                                    )}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
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
      </Tabs>
    </div>
  )
}

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getAllActiveClientPackages,
  getPackagePayments,
  payPackage,
  deletePackagePayment,
  terminateClientPackage,
} from '@/shared/services'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Ticket,
  DollarSign,
  RotateCcw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  MoreHorizontal,
  User,
  Ban,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/shared/providers/AuthProvider'
import { useToast } from '@/shared/hooks/use-toast'
import { useInvalidateFinancial } from '@/modules/financial/queries'
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

export const PackageFinancials = () => {
  const { professionalId, user, role, companyId } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const invalidateFinancial = useInvalidateFinancial()

  // TanStack Query (cache 5 min) na chave 'financial' — as ações de quitar/
  // estornar invalidam via useInvalidateFinancial, como o resto do módulo
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['financial', 'packages-list', companyId],
    queryFn: async () => {
      const { data } = await getAllActiveClientPackages()
      if (!data || data.length === 0) return []

      const packageIds = data.map((p: any) => p.id)
      const { data: payments } = await getPackagePayments(packageIds)

      const paidMap = new Map<string, string>()
      payments?.forEach((p: any) => {
        if (p.client_package_id) paidMap.set(p.client_package_id, p.id)
      })

      return data.map((pkg: any) => ({
        ...pkg,
        payment_status: paidMap.has(pkg.id) ? 'paid' : 'pending',
        financial_record_id: paidMap.get(pkg.id),
      }))
    },
    staleTime: 5 * 60_000,
  })

  const handlePay = async (pkg: any) => {
    const actorId = professionalId || user?.id
    if (!actorId) {
      toast({
        title: 'Erro',
        description: 'Usuário não identificado.',
        variant: 'destructive',
      })
      return
    }
    setIsProcessing(pkg.id)

    const { error } = await payPackage(pkg, actorId)

    if (error) {
      toast({
        title: 'Erro ao processar pagamento',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Pagamento Confirmado',
        description: `Pacote de ${pkg.clients?.name} registrado com sucesso.`,
      })
      invalidateFinancial()
    }
    setIsProcessing(null)
  }

  const handleReverse = async (pkg: any) => {
    if (!pkg.financial_record_id) return
    setIsProcessing(pkg.id)

    const { error } = await deletePackagePayment(
      pkg.financial_record_id,
      professionalId || user?.id,
    )

    if (error) {
      toast({
        title: 'Erro ao estornar pagamento',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Estorno Realizado',
        description: `Pagamento de ${pkg.clients?.name} foi removido.`,
      })
      invalidateFinancial()
    }
    setIsProcessing(null)
  }

  const handleTerminate = async (pkg: any) => {
    setIsProcessing(pkg.id)

    const { error } = await terminateClientPackage(pkg.clients?.id, pkg.id)

    if (error) {
      toast({
        title: 'Erro ao terminar pacote',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Pacote Encerrado',
        description: `O pacote de ${pkg.clients?.name} foi forçado ao término.`,
      })
      invalidateFinancial()
    }
    setIsProcessing(null)
  }

  const formatCurrency = (val: number | undefined) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0)

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Ticket className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-medium">Controle de Pacotes Ativos</h3>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Pacote</TableHead>
              <TableHead>Data Compra</TableHead>
              <TableHead className="text-center">Sessões (Restantes)</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6">
                  Nenhum pacote ativo no momento.
                </TableCell>
              </TableRow>
            ) : (
              packages.map((pkg) => {
                const total = pkg.packages?.session_count || 0
                const remaining = pkg.sessions_remaining || 0
                const used = total - remaining
                const progress = total > 0 ? (used / total) * 100 : 0
                const packageValue =
                  (pkg.packages?.price || 0) - (pkg.discount_amount || 0)

                return (
                  <TableRow key={pkg.id}>
                    <TableCell className="font-medium">
                      {pkg.clients?.name}
                    </TableCell>
                    <TableCell>{pkg.packages?.name}</TableCell>
                    <TableCell>
                      {pkg.purchase_date &&
                        format(new Date(pkg.purchase_date), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-center">
                        <span className="text-xs font-semibold">
                          {remaining} restantes
                        </span>
                        <Progress value={progress} className="h-2 w-24" />
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(packageValue)}</TableCell>
                    <TableCell>
                      {pkg.payment_status === 'paid' ? (
                        <Badge className="bg-green-500 hover:bg-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Pago
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
                        {pkg.payment_status === 'paid' ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8"
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
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
                                  <strong>{pkg.clients?.name}</strong>?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleReverse(pkg)}
                                  disabled={isProcessing === pkg.id}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {isProcessing === pkg.id ? (
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
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                              >
                                <DollarSign className="mr-2 h-4 w-4" />
                                Quitar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Confirmar Pagamento
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Registrar o pagamento do pacote{' '}
                                  <strong>{pkg.packages?.name}</strong> para o
                                  cliente <strong>{pkg.clients?.name}</strong>?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handlePay(pkg)}
                                  disabled={isProcessing === pkg.id}
                                >
                                  {isProcessing === pkg.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    'Confirmar'
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
                              onClick={() =>
                                navigate(
                                  role === 'admin'
                                    ? `/admin/pacientes/${pkg.clients?.id}`
                                    : `/profissional/pacientes/${pkg.clients?.id}`,
                                )
                              }
                              className="cursor-pointer"
                            >
                              <User className="mr-2 h-4 w-4" />
                              <span>Ver Perfil do Cliente</span>
                            </DropdownMenuItem>

                            {role === 'admin' && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                                  >
                                    <Ban className="mr-2 h-4 w-4" />
                                    <span>Forçar Término</span>
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Forçar Término do Pacote?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja encerrar este
                                      pacote? As sessões restantes não poderão
                                      ser utilizadas para novos agendamentos e o
                                      pacote sairá da lista de ativos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancelar
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleTerminate(pkg)}
                                      disabled={isProcessing === pkg.id}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      {isProcessing === pkg.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        'Confirmar'
                                      )}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import {
  getClientSubscriptions,
  cancelClientSubscription,
  getMonthlyClientUsage,
} from '@/services'
import { ClientSubscription } from '@/types'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { CalendarDays, PlusCircle, XCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { ClientSubscriptionDialog } from './ClientSubscriptionDialog'

interface ClientSubscriptionsListProps {
  clientId: string
}

export const ClientSubscriptionsList = ({
  clientId,
}: ClientSubscriptionsListProps) => {
  const { toast } = useToast()
  const [subscriptions, setSubscriptions] = useState<ClientSubscription[]>([])
  const [usageData, setUsageData] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const fetchSubscriptions = async () => {
    setIsLoading(true)
    const { data } = await getClientSubscriptions(clientId)
    setSubscriptions(data || [])

    // Fetch usage for each active subscription
    if (data) {
      const usageMap: Record<string, number> = {}
      await Promise.all(
        data.map(async (sub) => {
          const { count } = await getMonthlyClientUsage(
            clientId,
            sub.service_id,
          )
          usageMap[sub.id] = count
        }),
      )
      setUsageData(usageMap)
    }

    setIsLoading(false)
  }

  useEffect(() => {
    if (clientId) {
      fetchSubscriptions()
    }
  }, [clientId])

  const handleCancel = async (id: string) => {
    const { error } = await cancelClientSubscription(id)
    if (error) {
      toast({
        title: 'Erro ao cancelar assinatura',
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Assinatura cancelada com sucesso' })
      fetchSubscriptions()
    }
  }

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex flex-col space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" /> Assinaturas Mensais Ativas
            </CardTitle>
            <CardDescription>
              Serviços contratados na modalidade mensal.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nova
          </Button>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma assinatura ativa encontrada para este paciente.
            </p>
          ) : (
            subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">
                      {sub.subscription_plans?.name || sub.services?.name}
                    </h4>
                    <Badge variant="outline">Ativo</Badge>
                  </div>
                  {sub.subscription_plans && (
                    <p className="text-xs text-muted-foreground">
                      Plano: {sub.services?.name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Início:{' '}
                    {format(new Date(sub.start_date), 'dd/MM/yyyy', {
                      locale: ptBR,
                    })}
                  </p>
                  <p className="text-sm font-medium text-primary">
                    Sessões este mês: {usageData[sub.id] || 0}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar Assinatura?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O paciente não poderá mais agendar este serviço como
                        mensal.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleCancel(sub.id)}>
                        Confirmar Cancelamento
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ClientSubscriptionDialog
        clientId={clientId}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubscriptionCreated={fetchSubscriptions}
      />
    </>
  )
}

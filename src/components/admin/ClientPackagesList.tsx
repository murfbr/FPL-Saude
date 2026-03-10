import { useEffect, useState } from 'react'
import { getClientPackages, cancelClientPackage } from '@/services'
import { ClientPackageWithDetails } from '@/types'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Ticket, PlusCircle, Ban } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AssignPackageDialog } from './AssignPackageDialog'
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
import { useToast } from '@/hooks/use-toast'

interface ClientPackagesListProps {
  clientId: string
}

// Extending type locally since we can't update types file
type ExtendedClientPackage = ClientPackageWithDetails & {
  status?: 'active' | 'cancelled' | 'completed'
}

export const ClientPackagesList = ({ clientId }: ClientPackagesListProps) => {
  const { toast } = useToast()
  const [packages, setPackages] = useState<ExtendedClientPackage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const fetchPackages = async () => {
    setIsLoading(true)
    const { data } = await getClientPackages(clientId)
    setPackages((data as ExtendedClientPackage[]) || [])
    setIsLoading(false)
  }

  useEffect(() => {
    if (clientId) {
      fetchPackages()
    }
  }, [clientId])

  const handleCancelPackage = async (packageId: string) => {
    const { error } = await cancelClientPackage(packageId)
    if (error) {
      toast({
        title: 'Erro ao cancelar pacote',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Pacote cancelado com sucesso!' })
      fetchPackages()
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
              <Ticket className="w-5 h-5" /> Pacotes
            </CardTitle>
            <CardDescription>
              Acompanhamento dos pacotes de serviços contratados.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {packages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum pacote encontrado para este paciente.
            </p>
          ) : (
            packages.map((pkg) => {
              const totalSessions = pkg.packages.session_count
              const remainingSessions = pkg.sessions_remaining
              const completedSessions = totalSessions - remainingSessions
              const progress = (completedSessions / totalSessions) * 100

              // Determine status (use db status if available, fallback to logic)
              const status =
                pkg.status || (remainingSessions > 0 ? 'active' : 'completed')
              const isCancelled = status === 'cancelled'
              const isActive = status === 'active'

              return (
                <div
                  key={pkg.id}
                  className={`space-y-2 p-3 rounded-lg border ${isCancelled ? 'bg-muted/50 opacity-75' : 'bg-background'}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm">
                          {pkg.packages.name}
                        </h4>
                        <Badge
                          variant={isActive ? 'default' : 'secondary'}
                          className="text-[10px] h-5"
                        >
                          {isCancelled
                            ? 'Cancelado'
                            : isActive
                              ? 'Ativo'
                              : 'Concluído'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {pkg.packages.services?.name} - Início em{' '}
                        {format(new Date(pkg.purchase_date), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium block">
                        {remainingSessions}/{totalSessions} sessões restantes
                      </span>
                      {isActive && remainingSessions <= 1 && (
                        <span className="text-xs font-semibold text-destructive">
                          Renovação Necessária
                        </span>
                      )}
                    </div>
                  </div>

                  <Progress value={progress} className="h-2" />

                  {isActive && (
                    <div className="flex justify-end pt-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Ban className="mr-1 h-3 w-3" />
                            Cancelar Pacote
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Cancelar Pacote?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja cancelar este pacote? As
                              sessões restantes ({remainingSessions}) não
                              poderão ser utilizadas. Esta ação não pode ser
                              desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleCancelPackage(pkg.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Confirmar Cancelamento
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <AssignPackageDialog
        clientId={clientId}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onPackageAssigned={fetchPackages}
      />
    </>
  )
}

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ServiceForm } from './ServiceForm'
import { PackageFormDialog } from '../../packages/components/PackageFormDialog'
import { SubscriptionPlanFormDialog } from '../../subscriptions/components/SubscriptionPlanFormDialog'
import {
  getServices,
  createService,
  updateService,
  deleteService,
} from '@/shared/services'
import {
  createPackage,
  updatePackage,
  deletePackage,
} from '@/shared/services'
import {
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
} from '@/shared/services'
import { Service, Package, SubscriptionPlan } from '@/shared/types'
import { useToast } from '@/shared/hooks/use-toast'
import {
  PlusCircle,
  Edit,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  Package as PackageIcon,
  CalendarRange,
  Plus,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const ServicesManager = () => {
  const [services, setServices] = useState<Service[]>([])
  const [subscriptionPlans, setSubscriptionPlans] = useState<
    SubscriptionPlan[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Service Dialogs
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)

  // Package Dialogs
  const [isPackageDialogOpen, setIsPackageDialogOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<Package | undefined>(
    undefined,
  )
  const [selectedServiceId, setSelectedServiceId] = useState<
    string | undefined
  >(undefined)

  // Plan Dialogs
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | undefined>(
    undefined,
  )

  const [expandedServices, setExpandedServices] = useState<string[]>([])

  const { toast } = useToast()

  const fetchData = async () => {
    setIsLoading(true)
    const [servicesRes, plansRes] = await Promise.all([
      getServices(),
      getSubscriptionPlans(undefined, true), // Fetch all including inactive for potential future admin toggle
    ])
    setServices(servicesRes.data || [])
    setSubscriptionPlans(plansRes.data || [])
    setIsLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const toggleServiceExpand = (serviceId: string) => {
    setExpandedServices((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId],
    )
  }

  // --- Service Actions ---

  const handleServiceSubmit = async (values: Omit<Service, 'id'>) => {
    setIsSubmitting(true)
    const promise = editingService
      ? updateService(editingService.id, values)
      : createService(values)

    const { error } = await promise
    if (error) {
      toast({
        title: 'Erro ao salvar serviço',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: `Serviço ${editingService ? 'atualizado' : 'criado'} com sucesso!`,
      })
      setIsServiceDialogOpen(false)
      setEditingService(null)
      fetchData()
    }
    setIsSubmitting(false)
  }

  const handleServiceDelete = async (serviceId: string) => {
    const { error } = await deleteService(serviceId)
    if (error) {
      toast({
        title: 'Erro ao excluir serviço',
        description: error.message.includes('foreign key')
          ? 'Não é possível excluir pois existem vínculos.'
          : error.message,
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Serviço excluído com sucesso!' })
      fetchData()
    }
  }

  // --- Package Actions ---

  const handleOpenPackageDialog = (
    serviceId: string,
    pkg?: Package,
    e?: React.MouseEvent,
  ) => {
    e?.stopPropagation()
    setSelectedServiceId(serviceId)
    setEditingPackage(pkg)
    setIsPackageDialogOpen(true)
  }

  const handlePackageSubmit = async (values: any) => {
    setIsSubmitting(true)
    const promise = editingPackage
      ? updatePackage(editingPackage.id, values)
      : createPackage(values)

    const { error } = await promise
    if (error) {
      toast({ title: 'Erro ao salvar pacote', variant: 'destructive' })
    } else {
      toast({
        title: `Pacote ${editingPackage ? 'atualizado' : 'criado'} com sucesso!`,
      })
      setIsPackageDialogOpen(false)
      setEditingPackage(undefined)
      setSelectedServiceId(undefined)
      fetchData()
    }
    setIsSubmitting(false)
  }

  const handlePackageDelete = async (packageId: string) => {
    const { error } = await deletePackage(packageId)
    if (error) {
      toast({
        title: 'Erro ao excluir pacote',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Pacote inativado com sucesso!' })
      fetchData()
    }
  }

  // --- Plan Actions ---

  const handleOpenPlanDialog = (
    serviceId: string,
    plan?: SubscriptionPlan,
    e?: React.MouseEvent,
  ) => {
    e?.stopPropagation()
    setSelectedServiceId(serviceId)
    setEditingPlan(plan)
    setIsPlanDialogOpen(true)
  }

  const handlePlanSubmit = async (values: any) => {
    setIsSubmitting(true)
    const promise = editingPlan
      ? updateSubscriptionPlan(editingPlan.id, values)
      : createSubscriptionPlan(values)

    const { error } = await promise
    if (error) {
      toast({ title: 'Erro ao salvar plano', variant: 'destructive' })
    } else {
      toast({
        title: `Plano ${editingPlan ? 'atualizado' : 'criado'} com sucesso!`,
      })
      setIsPlanDialogOpen(false)
      setEditingPlan(undefined)
      setSelectedServiceId(undefined)
      fetchData()
    }
    setIsSubmitting(false)
  }

  const handlePlanDelete = async (planId: string) => {
    const { error } = await deleteSubscriptionPlan(planId)
    if (error) {
      toast({
        title: 'Erro ao excluir plano',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Plano inativado com sucesso!' })
      fetchData()
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Catálogo de Serviços</h3>
        <Dialog
          open={isServiceDialogOpen}
          onOpenChange={(open) => {
            setIsServiceDialogOpen(open)
            if (!open) setEditingService(null)
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditingService(null)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Serviço
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingService ? 'Editar Serviço' : 'Novo Serviço'}
              </DialogTitle>
            </DialogHeader>
            <ServiceForm
              onSubmit={handleServiceSubmit}
              defaultValues={editingService || {}}
              isSubmitting={isSubmitting}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : services.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg text-muted-foreground">
          Nenhum serviço cadastrado. Comece adicionando um serviço.
        </div>
      ) : (
        <div className="space-y-4">
          {services.map((service) => {
            // Filter inactive packages
            const activePackages =
              service.packages?.filter((p) => p.is_active !== false) || []
            // Filter inactive subscription plans
            const activePlans = subscriptionPlans.filter(
              (p) => p.service_id === service.id && p.is_active !== false,
            )

            return (
              <Collapsible
                key={service.id}
                open={expandedServices.includes(service.id)}
                onOpenChange={() => toggleServiceExpand(service.id)}
              >
                <Card>
                  <CardHeader className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-9 p-0">
                            {expandedServices.includes(service.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="sr-only">Toggle</span>
                          </Button>
                        </CollapsibleTrigger>
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {service.name}
                            {service.requires_observation === false && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                                Sem Prontuário
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1">
                              Avulso: {formatCurrency(service.price)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              Max. {service.max_attendees}
                            </span>
                            <span>• {service.duration_minutes} min</span>
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingService(service)
                            setIsServiceDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Excluir Serviço?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação excluirá o serviço e todos os
                                pacotes/planos associados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleServiceDelete(service.id)}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-4 pl-0 pr-0 bg-muted/10 border-t">
                      <div className="p-4">
                        <Tabs defaultValue="packages" className="w-full">
                          <TabsList className="w-full justify-start border-b rounded-none p-0 h-auto bg-transparent mb-4">
                            <TabsTrigger
                              value="packages"
                              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                            >
                              Pacotes de Sessões
                            </TabsTrigger>
                            <TabsTrigger
                              value="plans"
                              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                            >
                              Planos Mensais
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent value="packages" className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <PackageIcon className="w-4 h-4" />
                                Pacotes disponíveis para {service.name}
                              </h4>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) =>
                                  handleOpenPackageDialog(
                                    service.id,
                                    undefined,
                                    e,
                                  )
                                }
                              >
                                <Plus className="mr-2 h-3.5 w-3.5" />
                                Adicionar Pacote
                              </Button>
                            </div>
                            {activePackages.length > 0 ? (
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {activePackages.map((pkg) => (
                                  <div
                                    key={pkg.id}
                                    className="bg-background rounded-md border p-3 shadow-sm flex flex-col justify-between"
                                  >
                                    <div>
                                      <div className="font-medium text-sm">
                                        {pkg.name}
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {pkg.session_count} sessões
                                      </div>
                                    </div>
                                    <div className="flex items-end justify-between mt-3">
                                      <div className="font-semibold text-sm">
                                        {formatCurrency(pkg.price)}
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={(e) =>
                                            handleOpenPackageDialog(
                                              service.id,
                                              pkg,
                                              e,
                                            )
                                          }
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6"
                                            >
                                              <Trash2 className="h-3 w-3 text-destructive" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>
                                                Excluir Pacote?
                                              </AlertDialogTitle>
                                              <AlertDialogDescription>
                                                Isso irá inativar o pacote.
                                                Histórico de compras será
                                                mantido.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>
                                                Cancelar
                                              </AlertDialogCancel>
                                              <AlertDialogAction
                                                onClick={() =>
                                                  handlePackageDelete(pkg.id)
                                                }
                                              >
                                                Excluir
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">
                                Nenhum pacote ativo configurado.
                              </p>
                            )}
                          </TabsContent>

                          <TabsContent value="plans" className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <CalendarRange className="w-4 h-4" />
                                Planos de assinatura para {service.name}
                              </h4>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) =>
                                  handleOpenPlanDialog(service.id, undefined, e)
                                }
                              >
                                <Plus className="mr-2 h-3.5 w-3.5" />
                                Adicionar Plano
                              </Button>
                            </div>
                            {activePlans.length > 0 ? (
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {activePlans.map((plan) => (
                                  <div
                                    key={plan.id}
                                    className="bg-background rounded-md border p-3 shadow-sm flex flex-col justify-between"
                                  >
                                    <div>
                                      <div className="font-medium text-sm">
                                        {plan.name}
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {plan.sessions_per_week}x por semana
                                        (estimado)
                                      </div>
                                    </div>
                                    <div className="flex items-end justify-between mt-3">
                                      <div className="font-semibold text-sm">
                                        {formatCurrency(plan.price)} / mês
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={(e) =>
                                            handleOpenPlanDialog(
                                              service.id,
                                              plan,
                                              e,
                                            )
                                          }
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-6 w-6"
                                            >
                                              <Trash2 className="h-3 w-3 text-destructive" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>
                                                Excluir Plano?
                                              </AlertDialogTitle>
                                              <AlertDialogDescription>
                                                Isso irá inativar o plano.
                                                Histórico de assinaturas será
                                                mantido.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>
                                                Cancelar
                                              </AlertDialogCancel>
                                              <AlertDialogAction
                                                onClick={() =>
                                                  handlePlanDelete(plan.id)
                                                }
                                              >
                                                Excluir
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">
                                Nenhum plano mensal ativo configurado.
                              </p>
                            )}
                          </TabsContent>
                        </Tabs>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )
          })}
        </div>
      )}

      <PackageFormDialog
        isOpen={isPackageDialogOpen}
        onOpenChange={setIsPackageDialogOpen}
        onSubmit={handlePackageSubmit}
        defaultValues={editingPackage}
        isSubmitting={isSubmitting}
        fixedServiceId={selectedServiceId}
      />

      {selectedServiceId && (
        <SubscriptionPlanFormDialog
          isOpen={isPlanDialogOpen}
          onOpenChange={setIsPlanDialogOpen}
          onSubmit={handlePlanSubmit}
          defaultValues={editingPlan}
          isSubmitting={isSubmitting}
          fixedServiceId={selectedServiceId}
        />
      )}
    </div>
  )
}

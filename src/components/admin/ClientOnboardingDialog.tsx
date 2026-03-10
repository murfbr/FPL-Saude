import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { Client, Service, Package } from '@/types'
import { getServices } from '@/services'
import { getPackages } from '@/services'
import {
  createClientSubscription,
  assignPackageToClient,
} from '@/services'
import { Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface ClientOnboardingDialogProps {
  client: Client | null
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export const ClientOnboardingDialog = ({
  client,
  isOpen,
  onOpenChange,
}: ClientOnboardingDialogProps) => {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [services, setServices] = useState<Service[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [selectedPackages, setSelectedPackages] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      Promise.all([getServices(), getPackages()])
        .then(([servicesRes, packagesRes]) => {
          setServices(
            (servicesRes.data || []).filter((s) => s.value_type === 'monthly'),
          )
          setPackages(packagesRes.data || [])
        })
        .finally(() => setIsLoading(false))
    }
  }, [isOpen])

  const handleSkip = () => {
    onOpenChange(false)
    if (client) {
      navigate(`/admin/pacientes/${client.id}`)
    }
  }

  const handleSubmit = async () => {
    if (!client) return
    setIsSubmitting(true)

    try {
      const promises = []

      // Create subscriptions
      for (const serviceId of selectedServices) {
        promises.push(
          createClientSubscription({
            client_id: client.id,
            service_id: serviceId,
            start_date: new Date().toISOString(),
            end_date: null,
            status: 'active',
          }),
        )
      }

      // Assign packages
      for (const packageId of selectedPackages) {
        const pkg = packages.find((p) => p.id === packageId)
        if (pkg) {
          promises.push(
            assignPackageToClient(client.id, packageId, pkg.session_count),
          )
        }
      }

      await Promise.all(promises)

      toast({
        title: 'Sucesso',
        description: 'Serviços e pacotes associados com sucesso!',
      })

      onOpenChange(false)
      navigate(`/admin/pacientes/${client.id}`)
    } catch (error) {
      console.error(error)
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao associar os itens.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const togglePackage = (id: string) => {
    setSelectedPackages((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  if (!client) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configuração Inicial: {client.name}</DialogTitle>
          <DialogDescription>
            Selecione serviços mensais e pacotes para associar imediatamente a
            este paciente.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Assinaturas Mensais</h3>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : services.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum serviço mensal disponível.
                </p>
              ) : (
                <div className="space-y-2">
                  {services.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center space-x-2 rounded-md border p-3 hover:bg-accent cursor-pointer"
                      onClick={() => toggleService(service.id)}
                    >
                      <Checkbox
                        id={`srv-${service.id}`}
                        checked={selectedServices.includes(service.id)}
                        onCheckedChange={() => toggleService(service.id)}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={`srv-${service.id}`}
                          className="cursor-pointer font-medium"
                        >
                          {service.name}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          R$ {service.price.toFixed(2)}/mês
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-3">Pacotes de Sessões</h3>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : packages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum pacote disponível.
                </p>
              ) : (
                <div className="space-y-2">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="flex items-center space-x-2 rounded-md border p-3 hover:bg-accent cursor-pointer"
                      onClick={() => togglePackage(pkg.id)}
                    >
                      <Checkbox
                        id={`pkg-${pkg.id}`}
                        checked={selectedPackages.includes(pkg.id)}
                        onCheckedChange={() => togglePackage(pkg.id)}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={`pkg-${pkg.id}`}
                          className="cursor-pointer font-medium"
                        >
                          {pkg.name}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {pkg.session_count} sessões - R${' '}
                          {pkg.price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleSkip}>
            Pular e Ir para Detalhes
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              (selectedServices.length === 0 && selectedPackages.length === 0)
            }
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar e Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

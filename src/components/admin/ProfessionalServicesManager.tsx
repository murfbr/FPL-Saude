import { useState, useEffect } from 'react'
import { Service } from '@/types'
import { getServices } from '@/services'
import {
  getServicesByProfessional,
  addServiceToProfessional,
  removeServiceFromProfessional,
} from '@/services'
import { useToast } from '@/hooks/use-toast'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'

interface ProfessionalServicesManagerProps {
  professionalId: string
}

export const ProfessionalServicesManager = ({
  professionalId,
}: ProfessionalServicesManagerProps) => {
  const { toast } = useToast()
  const [allServices, setAllServices] = useState<Service[]>([])
  const [associatedServiceIds, setAssociatedServiceIds] = useState<Set<string>>(
    new Set(),
  )
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      const [allServicesRes, associatedServicesRes] = await Promise.all([
        getServices(),
        getServicesByProfessional(professionalId),
      ])

      if (allServicesRes.data) {
        setAllServices(allServicesRes.data)
      }
      if (associatedServicesRes.data) {
        setAssociatedServiceIds(
          new Set(associatedServicesRes.data.map((s) => s.id)),
        )
      }
      setIsLoading(false)
    }
    fetchData()
  }, [professionalId])

  const handleServiceToggle = async (serviceId: string, isChecked: boolean) => {
    const isCurrentlyAssociated = associatedServiceIds.has(serviceId)

    if (isChecked && !isCurrentlyAssociated) {
      const { error } = await addServiceToProfessional(
        professionalId,
        serviceId,
      )
      if (error) {
        toast({ title: 'Erro ao adicionar serviço', variant: 'destructive' })
      } else {
        setAssociatedServiceIds((prev) => new Set(prev).add(serviceId))
        toast({ title: 'Serviço adicionado com sucesso!' })
      }
    } else if (!isChecked && isCurrentlyAssociated) {
      const { error } = await removeServiceFromProfessional(
        professionalId,
        serviceId,
      )
      if (error) {
        toast({ title: 'Erro ao remover serviço', variant: 'destructive' })
      } else {
        setAssociatedServiceIds((prev) => {
          const newSet = new Set(prev)
          newSet.delete(serviceId)
          return newSet
        })
        toast({ title: 'Serviço removido com sucesso!' })
      }
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Serviços</CardTitle>
        <CardDescription>
          Selecione os serviços que este profissional oferece.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {allServices.map((service) => (
          <div
            key={service.id}
            className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50"
          >
            <Checkbox
              id={`service-${service.id}`}
              checked={associatedServiceIds.has(service.id)}
              onCheckedChange={(checked) =>
                handleServiceToggle(service.id, !!checked)
              }
            />
            <Label
              htmlFor={`service-${service.id}`}
              className="flex-1 cursor-pointer"
            >
              {service.name}
            </Label>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

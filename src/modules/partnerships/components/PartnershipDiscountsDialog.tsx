import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/shared/hooks/use-toast'
import { Partnership, Service, PartnershipDiscount } from '@/shared/types'
import { getServices } from '@/shared/services'
import {
  getDiscountsForPartnership,
  setPartnershipDiscounts,
} from '@/shared/services'

interface PartnershipDiscountsDialogProps {
  partnership: Partnership | null
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export const PartnershipDiscountsDialog = ({
  partnership,
  isOpen,
  onOpenChange,
}: PartnershipDiscountsDialogProps) => {
  const { toast } = useToast()
  const [services, setServices] = useState<Service[]>([])
  const [discounts, setDiscounts] = useState<
    Record<string, number | undefined>
  >({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen && partnership) {
      setIsLoading(true)
      Promise.all([
        getServices(),
        getDiscountsForPartnership(partnership.id),
      ]).then(([servicesRes, discountsRes]) => {
        setServices(servicesRes.data || [])
        const initialDiscounts: Record<string, number | undefined> = {}
        ;(discountsRes.data || []).forEach((d) => {
          const key = d.service_id || 'global'
          initialDiscounts[key] = d.discount_percentage
        })
        setDiscounts(initialDiscounts)
        setIsLoading(false)
      })
    }
  }, [isOpen, partnership])

  const handleDiscountChange = (key: string, value: string) => {
    const percentage = value === '' ? undefined : parseFloat(value)
    setDiscounts((prev) => ({ ...prev, [key]: percentage }))
  }

  const handleSave = async () => {
    if (!partnership) return
    setIsSubmitting(true)

    const discountsToSave: Omit<
      PartnershipDiscount,
      'id' | 'created_at' | 'partnership_id'
    >[] = Object.entries(discounts)
      .filter(([, value]) => value !== undefined && value >= 0 && value <= 100)
      .map(([key, value]) => ({
        service_id: key === 'global' ? null : key,
        discount_percentage: value!,
      }))

    const { error } = await setPartnershipDiscounts(
      partnership.id,
      discountsToSave,
    )

    if (error) {
      toast({ title: 'Erro ao salvar descontos', variant: 'destructive' })
    } else {
      toast({ title: 'Descontos atualizados com sucesso!' })
      onOpenChange(false)
    }
    setIsSubmitting(false)
  }

  if (!partnership) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Descontos</DialogTitle>
          <DialogDescription>
            Defina os descontos para a parceria "{partnership.name}".
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="global-discount" className="font-semibold">
                Desconto Geral (%)
              </Label>
              <Input
                id="global-discount"
                type="number"
                min="0"
                max="100"
                className="w-24"
                value={discounts['global'] ?? ''}
                onChange={(e) => handleDiscountChange('global', e.target.value)}
                placeholder="N/A"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Descontos específicos por serviço (prevalecem sobre o geral):
            </p>
            <ScrollArea className="h-64 border rounded-md p-4">
              <div className="space-y-3">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between"
                  >
                    <Label htmlFor={`service-${service.id}`}>
                      {service.name}
                    </Label>
                    <Input
                      id={`service-${service.id}`}
                      type="number"
                      min="0"
                      max="100"
                      className="w-24"
                      value={discounts[service.id] ?? ''}
                      onChange={(e) =>
                        handleDiscountChange(service.id, e.target.value)
                      }
                      placeholder="N/A"
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? 'Salvando...' : 'Salvar Descontos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

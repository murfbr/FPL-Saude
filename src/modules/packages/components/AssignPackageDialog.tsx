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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useToast } from '@/shared/hooks/use-toast'
import { Package } from '@/shared/types'
import { getPackages } from '@/shared/services'
import { assignPackageToClient } from '@/shared/services'
import { Loader2, CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/shared/lib/utils'

interface AssignPackageDialogProps {
  clientId: string
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onPackageAssigned: () => void
}

export const AssignPackageDialog = ({
  clientId,
  isOpen,
  onOpenChange,
  onPackageAssigned,
}: AssignPackageDialogProps) => {
  const { toast } = useToast()
  const [packages, setPackages] = useState<Package[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')
  const [purchaseDate, setPurchaseDate] = useState<Date | undefined>(new Date())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      // Reset date to today on open
      setPurchaseDate(new Date())
      getPackages().then(({ data }) => {
        setPackages(data || [])
        setIsLoading(false)
      })
    }
  }, [isOpen])

  const handleAssign = async () => {
    if (!selectedPackageId) return

    const selectedPkg = packages.find((p) => p.id === selectedPackageId)
    if (!selectedPkg) return

    setIsSubmitting(true)
    const { error } = await assignPackageToClient(
      clientId,
      selectedPkg.id,
      selectedPkg.session_count,
      purchaseDate,
    )

    if (error) {
      toast({
        title: 'Erro ao atribuir pacote',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Pacote atribuído com sucesso!' })
      onPackageAssigned()
      onOpenChange(false)
      setSelectedPackageId('')
    }
    setIsSubmitting(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-visible">
        <DialogHeader>
          <DialogTitle>Adicionar Pacote ao Cliente</DialogTitle>
          <DialogDescription>
            Selecione um pacote e a data de início para atribuir a este cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Selecione o Pacote</Label>
            <Select
              value={selectedPackageId}
              onValueChange={setSelectedPackageId}
            >
              <SelectTrigger disabled={isLoading}>
                <SelectValue placeholder="Escolha um pacote..." />
              </SelectTrigger>
              <SelectContent>
                {packages.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    Nenhum pacote disponível.
                  </div>
                ) : (
                  packages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      {pkg.name} - {pkg.services?.name} ({pkg.session_count}{' '}
                      sessões)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 flex flex-col">
            <Label>Data de Início</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={'outline'}
                  className={cn(
                    'w-full pl-3 text-left font-normal',
                    !purchaseDate && 'text-muted-foreground',
                  )}
                >
                  {purchaseDate ? (
                    format(purchaseDate, 'PPP', { locale: ptBR })
                  ) : (
                    <span>Selecione uma data</span>
                  )}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={purchaseDate}
                  onSelect={setPurchaseDate}
                  disabled={(date) =>
                    date >
                    new Date(
                      new Date().setFullYear(new Date().getFullYear() + 1),
                    )
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleAssign}
            disabled={isSubmitting || !selectedPackageId || !purchaseDate}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

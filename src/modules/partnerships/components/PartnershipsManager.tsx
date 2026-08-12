import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/shared/hooks/use-toast'
import { PlusCircle, Edit, Trash2, Percent, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Partnership } from '@/shared/types'
import {
  getAllPartnerships,
  createPartnership,
  updatePartnership,
  deletePartnership,
} from '@/shared/services'
import { PartnershipForm } from './PartnershipForm'
import { PartnershipDiscountsDialog } from './PartnershipDiscountsDialog'

export const PartnershipsManager = () => {
  const [partnerships, setPartnerships] = useState<Partnership[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDiscountsOpen, setIsDiscountsOpen] = useState(false)
  const [editingPartnership, setEditingPartnership] =
    useState<Partnership | null>(null)
  const { toast } = useToast()

  const fetchPartnerships = async () => {
    setIsLoading(true)
    const { data } = await getAllPartnerships({ includeInactive: true })
    setPartnerships(data || [])
    setIsLoading(false)
  }

  useEffect(() => {
    fetchPartnerships()
  }, [])

  const handleFormSubmit = async (
    values: Omit<Partnership, 'id' | 'created_at'>,
  ) => {
    setIsSubmitting(true)
    const promise = editingPartnership
      ? updatePartnership(editingPartnership.id, values)
      : createPartnership(values)

    const { error } = await promise
    if (error) {
      toast({ title: 'Erro ao salvar parceria', variant: 'destructive' })
    } else {
      toast({
        title: `Parceria ${editingPartnership ? 'atualizada' : 'criada'} com sucesso!`,
      })
      setIsFormOpen(false)
      setEditingPartnership(null)
      fetchPartnerships()
    }
    setIsSubmitting(false)
  }

  const handleReactivate = async (partnershipId: string) => {
    const { error } = await updatePartnership(partnershipId, { is_active: true } as Partial<Partnership>)
    if (error) {
      toast({ title: 'Erro ao reativar parceria', variant: 'destructive' })
    } else {
      toast({ title: 'Parceria reativada!' })
      fetchPartnerships()
    }
  }

  const handleDelete = async (partnershipId: string) => {
    const { error } = await deletePartnership(partnershipId)
    if (error) {
      toast({ title: 'Erro ao desativar parceria', variant: 'destructive' })
    } else {
      toast({ title: 'Parceria desativada. Vínculos e histórico preservados.' })
      fetchPartnerships()
    }
  }

  const openForm = (partnership: Partnership | null) => {
    setEditingPartnership(partnership)
    setIsFormOpen(true)
  }

  const openDiscounts = (partnership: Partnership) => {
    setEditingPartnership(partnership)
    setIsDiscountsOpen(true)
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => openForm(null)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nova Parceria
          </Button>
        </div>
        {isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partnerships.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {p.name}
                      {(p as Partnership & { is_active?: boolean }).is_active === false && (
                        <Badge variant="destructive" className="text-[10px] h-4 px-1.5 font-normal">
                          Inativa
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{p.description || '-'}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openDiscounts(p)}
                    >
                      <Percent className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openForm(p)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {(p as Partnership & { is_active?: boolean }).is_active === false ? (
                      <Button
                        variant="outline"
                        size="icon"
                        title="Reativar parceria"
                        onClick={() => handleReactivate(p.id)}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Desativar parceria?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              A parceria sai das listas de seleção. Clientes já
                              vinculados e o histórico são preservados, e você
                              pode reativá-la aqui quando quiser.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(p.id)}>
                              Desativar
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
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPartnership ? 'Editar Parceria' : 'Nova Parceria'}
            </DialogTitle>
          </DialogHeader>
          <PartnershipForm
            onSubmit={handleFormSubmit}
            defaultValues={editingPartnership || {}}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <PartnershipDiscountsDialog
        partnership={editingPartnership}
        isOpen={isDiscountsOpen}
        onOpenChange={setIsDiscountsOpen}
      />
    </>
  )
}

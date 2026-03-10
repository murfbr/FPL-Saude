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
import { useToast } from '@/hooks/use-toast'
import { PlusCircle, Edit, Trash2, Percent } from 'lucide-react'
import { Partnership } from '@/types'
import {
  getAllPartnerships,
  createPartnership,
  updatePartnership,
  deletePartnership,
} from '@/services'
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
    const { data } = await getAllPartnerships()
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

  const handleDelete = async (partnershipId: string) => {
    const { error } = await deletePartnership(partnershipId)
    if (error) {
      toast({ title: 'Erro ao excluir parceria', variant: 'destructive' })
    } else {
      toast({ title: 'Parceria excluída com sucesso!' })
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
                  <TableCell className="font-medium">{p.name}</TableCell>
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
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Tem certeza que deseja excluir?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(p.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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

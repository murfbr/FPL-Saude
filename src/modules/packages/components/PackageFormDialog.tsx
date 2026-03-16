import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { PackageForm } from './PackageForm'
import { Package } from '@/shared/types'

interface PackageFormDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onSubmit: (values: any) => Promise<void>
  defaultValues?: Partial<Package>
  isSubmitting: boolean
  fixedServiceId?: string
}

export const PackageFormDialog = ({
  isOpen,
  onOpenChange,
  onSubmit,
  defaultValues,
  isSubmitting,
  fixedServiceId,
}: PackageFormDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {defaultValues ? 'Editar Pacote' : 'Novo Pacote'}
          </DialogTitle>
          <DialogDescription>
            {fixedServiceId
              ? 'Criando pacote vinculado ao serviço selecionado.'
              : 'Preencha os dados do pacote de serviços.'}
          </DialogDescription>
        </DialogHeader>
        <PackageForm
          onSubmit={onSubmit}
          defaultValues={defaultValues}
          isSubmitting={isSubmitting}
          fixedServiceId={fixedServiceId}
        />
      </DialogContent>
    </Dialog>
  )
}

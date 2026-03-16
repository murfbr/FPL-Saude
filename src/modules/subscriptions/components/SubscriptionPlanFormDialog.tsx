import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { SubscriptionPlanForm } from './SubscriptionPlanForm'
import { SubscriptionPlan } from '@/shared/types'

interface SubscriptionPlanFormDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onSubmit: (values: any) => Promise<void>
  defaultValues?: Partial<SubscriptionPlan>
  isSubmitting: boolean
  fixedServiceId: string
}

export const SubscriptionPlanFormDialog = ({
  isOpen,
  onOpenChange,
  onSubmit,
  defaultValues,
  isSubmitting,
  fixedServiceId,
}: SubscriptionPlanFormDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {defaultValues ? 'Editar Plano Mensal' : 'Novo Plano Mensal'}
          </DialogTitle>
          <DialogDescription>
            Configure um plano de assinatura mensal para este serviço.
          </DialogDescription>
        </DialogHeader>
        <SubscriptionPlanForm
          onSubmit={onSubmit}
          defaultValues={defaultValues}
          isSubmitting={isSubmitting}
          fixedServiceId={fixedServiceId}
        />
      </DialogContent>
    </Dialog>
  )
}

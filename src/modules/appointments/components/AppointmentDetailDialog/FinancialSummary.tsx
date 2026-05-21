import { DollarSign, Edit2, Loader2, Check, X, PackageCheck, CreditCard, Banknote } from 'lucide-react'
import { Appointment } from '@/shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface FinancialSummaryProps {
  appointment: Appointment
  state: any
  actions: any
}

export const FinancialSummary = ({ appointment, state, actions }: FinancialSummaryProps) => {
  const {
    canViewFinancials,
    canEdit,
    isEditingDiscount,
    discountValue,
    isSavingDiscount,
    isZeroCost,
    isPackage,
    isMonthlySubscription,
    servicePrice,
    currentDiscount,
    finalPrice,
    packageDetails,
    subscriptionDetails,
  } = state

  const {
    setIsEditingDiscount,
    setDiscountValue,
    handleSaveDiscount,
  } = actions

  return (
    <>
      {/* Financeiro / Desconto */}
      {canViewFinancials && (
        <div className="flex items-start gap-3 col-span-1 sm:col-span-2 bg-muted/20 p-3 rounded-md border">
          <DollarSign className="h-5 w-5 text-primary mt-1" />
          <div className="w-full">
            <div className="flex justify-between items-center mb-1">
              <p className="text-sm text-muted-foreground font-medium">Financeiro</p>
              {canEdit && !isEditingDiscount && !isZeroCost && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setIsEditingDiscount(true)}
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  Editar Desconto
                </Button>
              )}
            </div>

            {isZeroCost ? (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span>Método de Pagamento:</span>
                  <span className="font-medium text-blue-600">
                    {isPackage ? 'Pacote Pré-pago' : 'Assinatura Mensal'}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-1 mt-1">
                  <span>Valor Final (Sessão):</span>
                  <span>R$ 0,00</span>
                </div>
              </div>
            ) : isEditingDiscount ? (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1">
                  <Label htmlFor="discount-edit" className="text-xs">
                    Desconto Pontual (R$)
                  </Label>
                  <Input
                    id="discount-edit"
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="h-8 text-sm mt-1"
                    min="0"
                  />
                </div>
                <div className="flex items-end gap-1 pb-0.5">
                  <Button
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleSaveDiscount}
                    disabled={isSavingDiscount}
                  >
                    {isSavingDiscount ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setIsEditingDiscount(false)
                      setDiscountValue(appointment.discount_amount?.toString() || '0')
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span>Desconto Aplicado:</span>
                  <span
                    className={
                      currentDiscount > 0
                        ? 'text-green-600 font-medium'
                        : 'text-muted-foreground'
                    }
                  >
                    - R$ {currentDiscount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-1 mt-1">
                  <span>Valor Final:</span>
                  <span>R$ {finalPrice.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Method Block */}
      <div className={`flex items-start gap-3 col-span-1 sm:col-span-2 p-3 rounded-md border ${
        isPackage ? 'bg-blue-50/60 border-blue-200' :
        isMonthlySubscription ? 'bg-purple-50/60 border-purple-200' :
        'bg-muted/20'
      }`}>
        {isPackage ? (
          <PackageCheck className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        ) : isMonthlySubscription ? (
          <CreditCard className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
        ) : (
          <Banknote className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        )}
        <div className="flex-1">
          <p className="text-sm font-medium mb-1">
            {isPackage ? 'Forma de Pagamento: Pacote de Sessões' :
             isMonthlySubscription ? 'Forma de Pagamento: Assinatura Mensal' :
             'Forma de Pagamento: Sessão Avulsa'}
          </p>
          {isPackage && (
            packageDetails ? (
              <div className="text-xs text-blue-800 bg-blue-100/50 p-2 rounded mt-2 space-y-1">
                <p><span className="font-bold">Pacote vinculado:</span> {packageDetails.name}</p>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <p>
                    <span className="font-medium">Uso do pacote:</span>{' '}
                    <span className="font-bold text-blue-600">
                      {Math.max(0, packageDetails.sessions_total - packageDetails.sessions_remaining)}
                    </span>{' '}
                    / {packageDetails.sessions_total}
                  </p>
                  <p>
                    <span className="font-medium">Restam:</span>{' '}
                    <span className={packageDetails.sessions_remaining <= 2 ? 'text-red-600 font-bold' : 'font-bold'}>
                      {packageDetails.sessions_remaining}
                    </span>{' '}
                    sessões
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-blue-500 italic mt-2">Carregando detalhes do pacote...</p>
            )
          )}
          {isMonthlySubscription && (
            subscriptionDetails ? (
              <p className="text-xs text-purple-700">
                <span className="font-medium">Plano:</span> {subscriptionDetails.plan_name}
              </p>
            ) : (
              <p className="text-xs text-purple-500 italic">Carregando assinatura...</p>
            )
          )}
        </div>
      </div>
    </>
  )
}

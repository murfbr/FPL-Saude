import {
  DollarSign,
  CheckCircle,
  AlertCircle,
  Percent,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { AppointmentFormValues } from './useAppointmentForm'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface FinancialSectionProps {
  form: UseFormReturn<AppointmentFormValues>
  state: any
  actions: any
  handleNavigateToProfile: () => void
}

export const FinancialSection = ({ form, state, actions, handleNavigateToProfile }: FinancialSectionProps) => {
  const {
    clientId,
    serviceId,
    checkingEntitlements,
    activeSubscription,
    availablePackages,
    exhaustedPackages,
    allowExhausted,
    displayablePackages,
    appliedPartnershipDiscount,
    selectedClient,
    selectedService,
    discount,
  } = state

  const { setAllowExhausted } = actions

  if (!clientId || !serviceId) return null

  const isPackageMode = !activeSubscription && form.watch('usePackage') && displayablePackages.length > 0
  const isSubscriptionMode = !!activeSubscription
  const isCasualMode = !isSubscriptionMode && !isPackageMode

  const originalPrice = selectedService?.price || 0
  const finalPrice = Math.max(0, originalPrice - discount)

  return (
    <div className="p-4 bg-muted/30 rounded-lg border">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-primary" />
        Financeiro
      </h4>

      {checkingEntitlements ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Verificando planos e descontos...
        </div>
      ) : (
        <>
          {/* Subscription Mode */}
          {isSubscriptionMode && (
            <div className="flex flex-col gap-2 p-3 bg-green-50 border border-green-100 rounded-md">
              <div className="flex items-center text-green-700 gap-2 text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                <span>Coberto por Assinatura</span>
              </div>
              <div className="text-sm text-green-600 ml-6">
                {activeSubscription?.subscription_plans?.name || 'Plano Mensal Ativo'}
              </div>
            </div>
          )}

          {/* Exhausted Package Warning */}
          {!isSubscriptionMode && availablePackages.length === 0 && exhaustedPackages.length > 0 && !allowExhausted && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 space-y-2 mb-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <AlertCircle className="w-4 h-4" />
                Pacote Esgotado
              </div>
              <p className="text-xs">O cliente esgotou todas as sessões do pacote contratado para este serviço.</p>
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-white flex-1 text-xs"
                  onClick={() => form.setValue('usePackage', false)}
                >
                  Agendar Avulso
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="bg-white text-red-700 hover:bg-red-100 flex-1 text-xs"
                  onClick={() => {
                    setAllowExhausted(true)
                    form.setValue('usePackage', true)
                    form.setValue('packageId', exhaustedPackages[0].id)
                  }}
                >
                  Usar mesmo assim
                </Button>
              </div>
            </div>
          )}

          {/* Package Option */}
          {!isSubscriptionMode && displayablePackages.length > 0 && (
            <FormField
              control={form.control}
              name="usePackage"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 mb-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(val) => {
                        field.onChange(val)
                        if (!val && allowExhausted) {
                          setAllowExhausted(false)
                        }
                      }}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Usar Pacote de Sessões</FormLabel>
                    <FormDescription>
                      {displayablePackages.length} pacote(s) disponível(eis).
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          )}

          {/* Package Mode */}
          {isPackageMode && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
              <FormField
                control={form.control}
                name="packageId"
                render={({ field }) => (
                  <FormItem>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o pacote" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {displayablePackages.map((pkg: any) => (
                          <SelectItem key={pkg.id} value={pkg.id}>
                            {pkg.packages.name} ({pkg.sessions_remaining} restantes)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-blue-700 text-sm flex gap-2 items-center">
                <CheckCircle className="w-4 h-4" />
                <span>
                  Sessão coberta por pacote. Nenhum pagamento avulso necessário.
                </span>
              </div>
            </div>
          )}

          {/* Casual Mode */}
          {isCasualMode && (
            <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                    Sessão Avulsa
                  </Badge>
                  {appliedPartnershipDiscount && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      Parceria {selectedClient?.partnerships?.name} ({appliedPartnershipDiscount.discount_percentage}%)
                    </Badge>
                  )}
                </div>
                {availablePackages.length === 0 && (
                  <Button
                    variant="link"
                    className="p-0 h-auto text-xs"
                    onClick={handleNavigateToProfile}
                    type="button"
                  >
                    Ver Contratos <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>

              <FormField
                control={form.control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Desconto (R$)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          className="pl-9"
                          placeholder="0,00"
                          min={0}
                          step="0.01"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      {appliedPartnershipDiscount
                        ? 'Desconto aplicado automaticamente pela parceria.'
                        : 'Insira um valor se houver desconto manual.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-1 pt-2 border-t">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Valor do Serviço:</span>
                  <span>R$ {originalPrice.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between items-center text-sm text-green-600">
                    <span>Desconto:</span>
                    <span>- R$ {discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-base pt-1">
                  <span className="font-medium">Total a Pagar:</span>
                  <span className="font-bold text-green-600">
                    R$ {finalPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

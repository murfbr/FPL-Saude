import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useNavigate } from 'react-router-dom'
import { ClientSelector } from '@/modules/clients/components/ClientSelector'

import { type AppointmentsRange } from '@/modules/appointments/queries'
import { useAppointmentForm } from './useAppointmentForm'
import { FinancialSection } from './FinancialSection'
import { RecurringOptions } from './RecurringOptions'
import { DateTimeSelection } from './DateTimeSelection'

interface AppointmentFormDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onAppointmentCreated: (range?: boolean | AppointmentsRange) => void
  initialDate?: Date
  isSpecificTimeSlot?: boolean
  preselectedProfessionalId?: string
}

export const AppointmentFormDialog = (props: AppointmentFormDialogProps) => {
  const navigate = useNavigate()
  const { form, state, actions } = useAppointmentForm(props)

  const handleNavigateToProfile = () => {
    if (!state.clientId) return
    props.onOpenChange(false)
    const basePath = state.role === 'admin' ? '/admin/pacientes' : '/profissional/pacientes'
    navigate(`${basePath}/${state.clientId}`)
  }

  return (
    <Dialog open={props.isOpen} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
          <DialogDescription>
            {props.isSpecificTimeSlot && props.initialDate
              ? `Agendamento para ${format(props.initialDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
              : 'Configure o agendamento.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(actions.onSubmit)} className="space-y-4">
            {/* 1. Client */}
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Cliente</FormLabel>
                  <FormControl>
                    <ClientSelector
                      clients={state.clients}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={state.isLoading.clients}
                      isLoading={state.isLoading.clients}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 2. Service */}
            <FormField
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serviço</FormLabel>
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val)
                      form.setValue('professionalId', '')
                    }}
                    defaultValue={field.value}
                    disabled={state.isLoading.services}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o serviço" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {state.services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} - R$ {s.price.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 3. Professional */}
            <FormField
              control={form.control}
              name="professionalId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profissional</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!state.serviceId || state.isLoading.professionals}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o profissional" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {state.professionals.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          {state.serviceId
                            ? 'Nenhum profissional disponível'
                            : 'Selecione um serviço primeiro'}
                        </div>
                      ) : (
                        state.professionals.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Financial Section */}
            <FinancialSection 
              form={form} 
              state={state} 
              actions={actions} 
              handleNavigateToProfile={handleNavigateToProfile} 
            />

            {/* Recurring */}
            <RecurringOptions 
              form={form} 
              isRecurring={state.isRecurring} 
              availableWeekdays={state.availableWeekdays} 
            />

            {/* Date/Time (Manual) */}
            <DateTimeSelection 
              form={form} 
              isSpecificTimeSlot={props.isSpecificTimeSlot} 
              currentMonth={state.currentMonth} 
              setCurrentMonth={actions.setCurrentMonth} 
              professionalId={state.professionalId} 
              serviceId={state.serviceId} 
              availableDates={state.availableDates} 
              schedules={state.schedules} 
              isLoadingSchedules={state.isLoading.schedules} 
            />

            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  form.formState.isSubmitting ||
                  !form.watch('startTime') ||
                  !form.watch('clientId') ||
                  !form.watch('serviceId') ||
                  !form.watch('professionalId')
                }
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Agendando...
                  </>
                ) : (
                  'Confirmar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  User,
  Stethoscope,
  Briefcase,
  Calendar,
  Clock,
  FileText,
  Repeat,
  PackageCheck,
  CreditCard,
  ExternalLink,
} from 'lucide-react'
import { formatInTimeZone } from '@/shared/lib/utils'
import { Appointment } from '@/shared/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { DetailItem, statusOptions } from './Shared'
import { FinancialSummary } from './FinancialSummary'

interface AppointmentPanelProps {
  appointment: Appointment
  state: any
  actions: any
}

export const AppointmentPanel = ({ appointment, state, actions }: AppointmentPanelProps) => {
  const {
    displayStatus,
    isUpdatingStatus,
    canChangeStatus,
    canViewFinancials,
    startTime,
    duration,
    calculatedEndTime,
    isPackage,
    isMonthlySubscription,
    servicePrice,
    recurrenceDays,
    isLoadingRecurrenceDays,
  } = state

  const { handleStatusChange, setIsHistoryModalOpen } = actions

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DetailItem
          icon={User}
          label="Cliente"
          value={
            <button
              className="font-medium text-primary hover:underline flex items-center gap-1 text-left"
              onClick={() => setIsHistoryModalOpen(true)}
            >
              {appointment.clients?.name}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </button>
          }
        />
        <DetailItem
          icon={Stethoscope}
          label="Serviço"
          value={
            <div className="flex flex-col">
              <span>{appointment.services?.name}</span>
              {isPackage ? (
                <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                  <PackageCheck className="h-3 w-3" /> Sessão de Pacote
                </span>
              ) : isMonthlySubscription ? (
                <span className="text-xs text-purple-600 font-medium flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> Assinatura Mensal
                </span>
              ) : canViewFinancials ? (
                <span className="text-xs text-muted-foreground">
                  Valor Base: R$ {servicePrice.toFixed(2)}
                </span>
              ) : null}
              {appointment.is_recurring && (
                <span className="text-xs text-primary font-medium flex items-center gap-1 mt-0.5">
                  <Repeat className="h-3 w-3" /> Recorrente
                  {recurrenceDays.length > 0 && (
                    <span className="text-muted-foreground ml-1 font-normal">
                      ({recurrenceDays.map((d: number) => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d]).join(', ')})
                    </span>
                  )}
                  {isLoadingRecurrenceDays && (
                    <span className="text-muted-foreground ml-1 font-normal animate-pulse">
                      (...)
                    </span>
                  )}
                </span>
              )}
            </div>
          }
        />
        <DetailItem
          icon={Briefcase}
          label="Profissional"
          value={appointment.professionals?.name}
        />
        <DetailItem
          icon={Calendar}
          label="Data"
          value={format(
            new Date(startTime),
            "EEEE, dd 'de' MMMM 'de' yyyy",
            {
              locale: ptBR,
            },
          )}
        />
        <DetailItem
          icon={Clock}
          label="Horário"
          value={`${formatInTimeZone(startTime, 'HH:mm')} - ${formatInTimeZone(calculatedEndTime, 'HH:mm')} (${duration} min)`}
        />
        <DetailItem
          icon={FileText}
          label="Status"
          value={
            canChangeStatus ? (
              <Select
                value={displayStatus}
                onValueChange={handleStatusChange}
                disabled={isUpdatingStatus}
              >
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className="capitalize">
                {statusOptions.find((o) => o.value === displayStatus)?.label || displayStatus}
              </Badge>
            )
          }
        />

        <FinancialSummary appointment={appointment} state={state} actions={actions} />
      </div>
    </div>
  )
}

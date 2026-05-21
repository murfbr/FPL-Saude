import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  PartyPopper,
  Building2,
  Briefcase,
  Calendar,
  Clock,
  FileText,
  AlignLeft,
  DollarSign,
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

interface EventPanelProps {
  appointment: Appointment
  state: any
  actions: any
}

export const EventPanel = ({ appointment, state, actions }: EventPanelProps) => {
  const {
    displayStatus,
    isUpdatingStatus,
    canChangeStatus,
    canViewFinancials,
    startTime,
    duration,
    calculatedEndTime,
  } = state

  const { handleStatusChange } = actions

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DetailItem icon={PartyPopper} label="Evento" value={appointment.event_title || '—'} />
        <DetailItem
          icon={Building2}
          label="Empresa / Contratante"
          value={appointment.event_contractor || <span className="text-muted-foreground italic text-sm">Não informado</span>}
        />
        <DetailItem
          icon={Briefcase}
          label="Profissional Responsável"
          value={appointment.professionals?.name || '—'}
        />
        <DetailItem
          icon={Calendar}
          label="Data"
          value={format(new Date(startTime), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        />
        <DetailItem
          icon={Clock}
          label="Horário"
          value={`${formatInTimeZone(startTime, 'HH:mm')} — ${formatInTimeZone(calculatedEndTime, 'HH:mm')} (${duration} min)`}
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
      </div>

      {appointment.event_description && (
        <div className="p-3 bg-muted/30 rounded-md border">
          <div className="flex items-center gap-2 mb-2">
            <AlignLeft className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Descrição / Detalhes</p>
          </div>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{appointment.event_description}</p>
        </div>
      )}

      {canViewFinancials && (
        <div className="flex items-start gap-3 p-3 rounded-md border bg-purple-50/60 border-purple-200">
          <DollarSign className="h-5 w-5 text-purple-600 mt-1" />
          <div>
            <p className="text-sm text-muted-foreground">Valor do Evento</p>
            <p className="font-bold text-lg text-purple-700">
              R$ {(appointment.event_price || 0).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {displayStatus === 'completed'
                ? 'Registrado financeiramente após conclusão'
                : 'Será registrado ao marcar como Concluído'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/shared/lib/firebase'
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Appointment, NoteEntry, isClinicEvent } from '@/shared/types'
import { format, isValid, addMinutes } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  User,
  Stethoscope,
  Briefcase,
  Calendar,
  Clock,
  FileText,
  Loader2,
  CalendarClock,
  Send,
  Trash2,
  DollarSign,
  Edit2,
  Check,
  X,
  PackageCheck,
  CreditCard,
  Banknote,
  ExternalLink,
  Repeat,
  History,
  StickyNote,
  PartyPopper,
  Building2,
  AlignLeft,
} from 'lucide-react'
import { useToast } from '@/shared/hooks/use-toast'
import {
  addClientNote,
  deleteAppointment,
  deleteFutureAppointments,
  updateAppointmentStatus,
  updateAppointment,
  getLastClientNotes,
  getClientNotesByAppointment,
} from '@/shared/services'
import { useUpdateAppointmentCache } from '@/modules/appointments/queries'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
import { RescheduleDialog } from './RescheduleDialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/shared/providers/AuthProvider'
import { useTenant } from '@/shared/contexts/TenantContext'
import { formatInTimeZone } from '@/shared/lib/utils'
import { getFriendlyErrorMessage } from '@/shared/lib/error-mapping'
import { getCompanyId } from '@/shared/lib/tenantStore'
import { getClientSubscriptions } from '@/modules/clients/service'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PatientHistoryModal } from '@/modules/clients/components/PatientHistoryModal'

interface AppointmentDetailDialogProps {
  appointment: Appointment | null
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onAppointmentUpdated: (shouldInvalidate?: boolean) => void
}

const DetailItem = ({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  className?: string
}) => (
  <div className={className || 'flex items-start gap-3'}>
    <Icon className="h-5 w-5 text-primary mt-1" />
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="font-medium">{value}</div>
    </div>
  </div>
)

const statusOptions = [
  { value: 'scheduled', label: 'Agendado' },
  { value: 'completed', label: 'Concluído' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'no_show', label: 'Faltou' },
]

export const AppointmentDetailDialog = ({
  appointment,
  isOpen,
  onOpenChange,
  onAppointmentUpdated,
}: AppointmentDetailDialogProps) => {
  const { toast } = useToast()
  const updateAppointmentCache = useUpdateAppointmentCache()
  const { user, professionalId, role } = useAuth()
  const { config } = useTenant()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [localStatus, setLocalStatus] = useState<string | null>(null)
  const [localNotes, setLocalNotes] = useState<NoteEntry[]>([])
  const [lastNotes, setLastNotes] = useState<NoteEntry[]>([])
  const [hasMoreNotes, setHasMoreNotes] = useState(false)
  const [isLoadingLastNotes, setIsLoadingLastNotes] = useState(false)
  const [deleteMode, setDeleteMode] = useState<'only-this' | 'this-and-future'>('only-this')
  const [packageDetails, setPackageDetails] = useState<{ name: string; sessions_remaining: number; sessions_total: number } | null>(null)
  const [subscriptionDetails, setSubscriptionDetails] = useState<{ plan_name: string } | null>(null)
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([])
  const [isLoadingRecurrenceDays, setIsLoadingRecurrenceDays] = useState(false)

  const navigate = useNavigate()

  // Discount editing state
  const [isEditingDiscount, setIsEditingDiscount] = useState(false)
  const [discountValue, setDiscountValue] = useState('')
  const [isSavingDiscount, setIsSavingDiscount] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)

  useEffect(() => {
    if (appointment) {
      setLocalStatus(appointment.status)
      setDiscountValue(appointment.discount_amount?.toString() || '0')
      setLocalNotes(appointment.notes || [])
      setPackageDetails(null)
      setSubscriptionDetails(null)

      // Para eventos, não há cliente vinculado — pular buscas de notas e pacotes
      if (isClinicEvent(appointment)) return

      const clientPackageId = (appointment as any).client_package_id
      const serviceValueType = (appointment.services as any).value_type

      // Fetch last 5 notes
      const clientId = (appointment as any).client_id
      if (clientId) {
        setIsLoadingLastNotes(true)
        
        // Parallel fetch for local and historical notes
        Promise.all([
          getClientNotesByAppointment(clientId, appointment.id),
          getLastClientNotes(clientId, 10)
        ]).then(([localRes, lastRes]) => {
          // Merge legacy appointment.notes to ensure nothing is lost visually before migration
          const legacyNotes = appointment.notes || []
          const fetchedLocal = localRes.data || []
          
          // Deduplicate based on date to avoid double showing during migration
          const combinedLocal = [...legacyNotes]
          fetchedLocal.forEach(fn => {
            if (!combinedLocal.some(cn => cn.date === fn.date)) {
              combinedLocal.push(fn)
            }
          })
          setLocalNotes(combinedLocal)
          
          // History notes (excluding local ones)
          if (lastRes.data) {
            const currentNoteDates = combinedLocal.map(n => n.date)
            const filtered = lastRes.data.filter(n => !currentNoteDates.includes(n.date))
            setLastNotes(filtered)
            setHasMoreNotes(lastRes.hasMore)
          }
        }).catch(() => {})
        .finally(() => setIsLoadingLastNotes(false))
      }

      // Fetch package details if this appointment uses a package
      if (clientPackageId) {
        const clientId = (appointment as any).client_id
        const companyId = getCompanyId()
        getDoc(doc(db, 'companies', companyId, 'clients', clientId, 'packages', clientPackageId))
          .then((snap) => {
            if (snap.exists()) {
              const data = snap.data()
              // Fetch the package template to get the name and session_count
              if (data.package_id) {
                getDoc(doc(db, 'companies', companyId, 'packages', data.package_id))
                  .then((pkgSnap) => {
                    setPackageDetails({
                      name: pkgSnap.exists() ? pkgSnap.data().name : 'Pacote',
                      sessions_remaining: data.sessions_remaining ?? 0,
                      sessions_total: pkgSnap.exists() ? (pkgSnap.data().session_count ?? 0) : 0,
                    })
                  }).catch(() => {
                    setPackageDetails({ name: 'Erro de pacote', sessions_remaining: data.sessions_remaining ?? 0, sessions_total: 0 })
                  })
              } else {
                 setPackageDetails({ name: 'Pacote Sem Template', sessions_remaining: data.sessions_remaining ?? 0, sessions_total: 0 })
              }
            } else {
              setPackageDetails({ name: 'Pacote Removido/Inexistente', sessions_remaining: 0, sessions_total: 0 })
            }
          })
          .catch(() => {
             setPackageDetails({ name: 'Erro ao carregar', sessions_remaining: 0, sessions_total: 0 })
          })
      } else {
        const clientId = (appointment as any).client_id
        const serviceId = (appointment as any).service_id || appointment.services?.id
        if (clientId && serviceId) {
          getClientSubscriptions(clientId)
            .then(({ data: subs }) => {
              const matchingSub = subs?.find((sub: any) => sub.service_id === serviceId)
              if (matchingSub) {
                setSubscriptionDetails({
                  plan_name: matchingSub.subscription_plans?.name || appointment.services?.name || 'Assinatura Mensal',
                })
              }
            })
            .catch(() => {})
        }
      }

      // Fetch recurring days
      if (appointment.is_recurring && (appointment as any).recurrence_group_id) {
        setIsLoadingRecurrenceDays(true)
        const companyId = getCompanyId()
        const q = query(
          collection(db, 'companies', companyId, 'appointments'),
          where('recurrence_group_id', '==', (appointment as any).recurrence_group_id),
          limit(10)
        )
        getDocs(q).then(snap => {
          const days = new Set<number>()
          snap.forEach(d => {
            const start = d.data().schedules?.start_time
            if (start) {
              const dateObj = new Date(start)
              if (isValid(dateObj)) {
                days.add(dateObj.getDay())
              }
            }
          })
          // Sort such that sequence makes sense (e.g. 1 2 3 for Mon Tue Wed)
          setRecurrenceDays(Array.from(days).sort()) 
        }).catch(() => {}).finally(() => setIsLoadingRecurrenceDays(false))
      } else {
        setRecurrenceDays([])
      }
    }
  }, [appointment, refreshTrigger])

  if (
    !appointment ||
    !appointment.schedules?.start_time ||
    !isValid(new Date(appointment.schedules.start_time))
  ) {
    return null
  }

  const handleDelete = async () => {
    if (!appointment) return
    setIsDeleting(true)
    
    const serviceFn = deleteMode === 'this-and-future' 
      ? deleteFutureAppointments 
      : deleteAppointment

    const { deletedIds, error } = await serviceFn(appointment.id)
    if (error) {
      toast({
        title: 'Erro ao excluir agendamento',
        description: getFriendlyErrorMessage(error),
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Agendamento(s) excluído(s) com sucesso!' })
      // Sempre remover do cache local imediatamente para a UI ficar rápida
      if (deletedIds && deletedIds.length > 0) {
        deletedIds.forEach(id => updateAppointmentCache(id, () => null))
      } else {
        updateAppointmentCache(appointment.id, () => null)
      }
      
      onAppointmentUpdated(deleteMode === 'this-and-future')
      onOpenChange(false)
    }
    setIsDeleting(false)
  }

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdatingStatus(true)
    setLocalStatus(newStatus)

    const { error } = await updateAppointmentStatus(appointment.id, newStatus)
    if (error) {
      setLocalStatus(appointment.status)
      toast({
        title: 'Erro ao atualizar status',
        description: getFriendlyErrorMessage(error),
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Status atualizado com sucesso.' })
      updateAppointmentCache(appointment.id, (old) => ({ ...old, status: newStatus }))
      onAppointmentUpdated(false)
      setRefreshTrigger(prev => prev + 1)
    }
    setIsUpdatingStatus(false)
  }

  const handleRescheduleSuccess = (shouldInvalidate?: boolean) => {
    onAppointmentUpdated(shouldInvalidate)
    onOpenChange(false)
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setIsSavingNote(true)

    const noteEntry: Omit<NoteEntry, 'id' | 'date'> = {
      professional_id: professionalId || user?.id || undefined,
      professional_name: user?.displayName || user?.email || 'Administrador',
      content: newNote,
      type: 'evolution',
      appointment_id: appointment.id
    }

    const { data, error } = await addClientNote(appointment.client_id, noteEntry)
    if (error) {
      toast({
        title: 'Erro ao adicionar nota',
        description: getFriendlyErrorMessage(error),
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Nota adicionada com sucesso!' })
      setNewNote('')
      if (data) {
        setLocalNotes((prev) => [...prev, data])
        updateAppointmentCache(appointment.id, (old) => ({
          ...old,
          notes: [...(old.notes || []), data]
        }))
      }
      onAppointmentUpdated(false)
    }
    setIsSavingNote(false)
  }

  const handleSaveDiscount = async () => {
    const val = parseFloat(discountValue)
    if (isNaN(val) || val < 0) {
      toast({
        title: 'Valor inválido',
        description: 'O desconto deve ser um número positivo.',
        variant: 'destructive',
      })
      return
    }

    setIsSavingDiscount(true)
    const { error } = await updateAppointment(appointment.id, {
      discount_amount: val,
    })

    if (error) {
      toast({
        title: 'Erro ao atualizar desconto',
        description: getFriendlyErrorMessage(error),
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Desconto atualizado com sucesso!' })
      setIsEditingDiscount(false)
      updateAppointmentCache(appointment.id, (old) => ({ ...old, discount_amount: val }))
      onAppointmentUpdated(false)
    }
    setIsSavingDiscount(false)
  }

  const startTime = appointment.schedules!.start_time!
  const isEvent = isClinicEvent(appointment)
  const duration = isEvent
    ? (appointment.event_duration_minutes || 60)
    : (appointment.services?.duration_minutes || 30)
  const calculatedEndTime = addMinutes(new Date(startTime), duration)

  const clientPackageId = (appointment as any).client_package_id
  const serviceValueType = (appointment.services as any)?.value_type ?? null

  const isPackage = !!clientPackageId
  const isMonthlySubscription = serviceValueType === 'monthly' || !!subscriptionDetails
  const isZeroCost = isPackage || isMonthlySubscription

  const servicePrice = appointment.services?.price || 0
  const currentDiscount = parseFloat(discountValue) || 0
  const finalPrice = isZeroCost
    ? 0
    : Math.max(0, servicePrice - currentDiscount)

  const displayStatus = localStatus || appointment.status
  const canEdit = ['scheduled'].includes(displayStatus)
  const isAdmin = role === 'admin'
  const canChangeStatus = isAdmin || role === 'professional'
  const canReschedule = isAdmin || config?.features?.professionals_can_reschedule
  const canViewFinancials = isAdmin || config?.features?.professionals_can_view_financials

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEvent && <PartyPopper className="h-5 w-5 text-purple-500" />}
              {isEvent ? 'Detalhes do Evento' : 'Detalhes do Agendamento'}
            </DialogTitle>
            <DialogDescription>
              {isEvent ? appointment.event_title : 'Informações completas sobre a sessão.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {isEvent ? (
              /* ===== PAINEL DE EVENTO ===== */
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

                {/* Descrição do evento */}
                {appointment.event_description && (
                  <div className="p-3 bg-muted/30 rounded-md border">
                    <div className="flex items-center gap-2 mb-2">
                      <AlignLeft className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">Descrição / Detalhes</p>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{appointment.event_description}</p>
                  </div>
                )}

                {/* Financeiro do evento */}
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
            ) : (
              /* ===== PAINEL DE AGENDAMENTO NORMAL ===== */
              <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem
                icon={User}
                label="Cliente"
                value={
                  <button
                    className="font-medium text-primary hover:underline flex items-center gap-1 text-left"
                    onClick={() => {
                      setIsHistoryModalOpen(true)
                    }}
                  >
                    {appointment.clients.name}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </button>
                }
              />
              <DetailItem
                icon={Stethoscope}
                label="Serviço"
                value={
                  <div className="flex flex-col">
                    <span>{appointment.services.name}</span>
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
                            ({recurrenceDays.map(d => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d]).join(', ')})
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
                value={appointment.professionals.name}
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
                      {statusOptions.find((o) => o.value === displayStatus)
                        ?.label || displayStatus}
                    </Badge>
                  )
                }
              />

              {/* Financeiro / Desconto */}
              {canViewFinancials && (
                <div className="flex items-start gap-3 col-span-1 sm:col-span-2 bg-muted/20 p-3 rounded-md border">
                  <DollarSign className="h-5 w-5 text-primary mt-1" />
                <div className="w-full">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm text-muted-foreground font-medium">
                      Financeiro
                    </p>
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
                            setDiscountValue(
                              appointment.discount_amount?.toString() || '0',
                            )
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
            </div>

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


            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-primary" />
                  Prontuário e Histórico
                </Label>
                <button
                  onClick={() => setIsHistoryModalOpen(true)}
                  className="text-[10px] text-primary hover:underline flex items-center gap-1"
                >
                  Ver Prontuário Completo
                  <ExternalLink className="h-2.5 w-2.5" />
                </button>
              </div>
              <ScrollArea className="h-[250px] w-full rounded-md border p-4 bg-muted/10">
                <div className="space-y-6">
                  {/* Previous Notes (History) */}
                  {lastNotes.length > 0 && (
                    <div className="space-y-4">
                      {lastNotes.map((note, index) => (
                        <div key={`history-${index}`} className="relative pl-4 border-l-2 border-muted">
                           <div className="flex justify-between items-center mb-1">
                             <span className="font-semibold text-[10px] text-muted-foreground italic">
                               Histórico: {note.professional_name}
                             </span>
                             <span className="text-[10px] text-muted-foreground">
                               {format(new Date(note.date), "dd/MM/yy", { locale: ptBR })}
                             </span>
                           </div>
                           <p className="text-xs text-muted-foreground/80 line-clamp-3">
                             {note.content}
                           </p>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 py-2">
                        <div className="h-[1px] flex-1 bg-border" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Início da Sessão Atual</span>
                        <div className="h-[1px] flex-1 bg-border" />
                      </div>
                    </div>
                  )}

                  {/* Current Session Notes */}
                  {localNotes && localNotes.length > 0 ? (
                    <div className="space-y-4">
                      {localNotes.map((note, index) => (
                        <div
                          key={`current-${index}`}
                          className="bg-background p-3 rounded-lg border shadow-sm"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-xs text-primary">
                              {note.professional_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(
                                new Date(note.date),
                                "dd/MM/yy 'às' HH:mm",
                                { locale: ptBR },
                              )}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">
                            {note.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {lastNotes.length > 0 ? 'Nenhuma evolução registrada nesta sessão ainda.' : 'Nenhuma anotação registrada.'}
                    </p>
                  )}
                </div>
              </ScrollArea>
              <div className="flex gap-2">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="min-h-[80px]"
                  placeholder="Adicionar nova anotação..."
                />
                <Button
                  size="icon"
                  className="h-auto"
                  onClick={handleAddNote}
                  disabled={isSavingNote || !newNote.trim()}
                >
                  {isSavingNote ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full sm:w-auto">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir Agendamento</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja{' '}
                      <strong>excluir permanentemente</strong> este registro?
                      <br />
                      Esta ação não pode ser desfeita. Para apenas cancelar e
                      manter o histórico, altere o status para "Cancelado".
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  {appointment.is_recurring && (
                    <div className="py-4 px-1">
                      <Label className="text-sm font-semibold mb-3 block flex items-center gap-2">
                        <Repeat className="w-4 h-4 text-destructive" />
                        Este é um agendamento recorrente
                      </Label>
                      <RadioGroup
                        value={deleteMode}
                        onValueChange={(val: any) => setDeleteMode(val)}
                        className="flex flex-col space-y-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="only-this" id="del-only-this" />
                          <Label htmlFor="del-only-this" className="font-normal cursor-pointer text-sm">
                            Excluir apenas este agendamento
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="this-and-future" id="del-this-and-future" />
                          <Label htmlFor="del-this-and-future" className="font-normal cursor-pointer text-sm font-medium text-destructive">
                            Excluir este e todos os agendamentos futuros
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        appointment.is_recurring && deleteMode === 'this-and-future' 
                          ? 'Confirmar Exclusão da Série' 
                          : 'Confirmar Exclusão'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {canReschedule && canEdit && !isEvent && (
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => setIsRescheduleOpen(true)}
              >
                <CalendarClock className="mr-2 h-4 w-4" />
                Remarcar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isEvent && (
        <RescheduleDialog
          isOpen={isRescheduleOpen}
          onOpenChange={setIsRescheduleOpen}
          oldAppointmentId={appointment.id}
          client={appointment.clients as any}
          service={appointment.services as any}
          professionalId={appointment.professional_id}
          onRescheduleSuccess={handleRescheduleSuccess}
          is_recurring={appointment.is_recurring}
          currentStartTime={appointment.schedules?.start_time}
        />
      )}
      
      <PatientHistoryModal
        clientId={(appointment as any).client_id}
        isOpen={isHistoryModalOpen}
        onOpenChange={setIsHistoryModalOpen}
      />
    </>
  )
}

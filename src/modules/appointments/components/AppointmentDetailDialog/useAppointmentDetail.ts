import { useState, useEffect } from 'react'
import { Appointment, NoteEntry, isClinicEvent } from '@/shared/types'
import { db } from '@/shared/lib/firebase'
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore'
import { isValid, addMinutes } from 'date-fns'
import { useToast } from '@/shared/hooks/use-toast'
import { useAuth } from '@/shared/providers/AuthProvider'
import { useTenant } from '@/shared/contexts/TenantContext'
import { getCompanyId } from '@/shared/lib/tenantStore'
import { getFriendlyErrorMessage } from '@/shared/lib/error-mapping'

import {
  addClientNote,
  getLastClientNotes,
  getClientNotesByAppointment,
} from '@/shared/services'
import { getClientSubscriptions, findActiveSubscriptionForService } from '@/modules/clients/service'
import { useUpdateAppointmentCache } from '@/modules/appointments/queries'
import { useDeleteAppointmentMutation, useUpdateAppointmentStatusMutation } from '@/modules/appointments/hooks/useAppointments'
import { deleteFutureAppointments, updateAppointment } from '@/shared/services' // Note: these are not in TanStack yet or we can use the ones we have

export function useAppointmentDetail({
  appointment,
  isOpen,
  onOpenChange,
  onAppointmentUpdated,
}: {
  appointment: Appointment | null
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onAppointmentUpdated: (shouldInvalidate?: boolean) => void
}) {
  const { toast } = useToast()
  const updateAppointmentCache = useUpdateAppointmentCache()
  const { user, professionalId, role } = useAuth()
  const { config } = useTenant()
  
  const deleteMutation = useDeleteAppointmentMutation()
  const statusMutation = useUpdateAppointmentStatusMutation()

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

      if (isClinicEvent(appointment)) return

      const clientPackageId = (appointment as any).client_package_id

      // Fetch last 5 notes
      const clientId = (appointment as any).client_id
      if (clientId) {
        setIsLoadingLastNotes(true)
        Promise.all([
          getClientNotesByAppointment(clientId, appointment.id),
          getLastClientNotes(clientId, 10)
        ]).then(([localRes, lastRes]) => {
          const legacyNotes = appointment.notes || []
          const fetchedLocal = localRes.data || []
          const combinedLocal = [...legacyNotes]
          fetchedLocal.forEach(fn => {
            if (!combinedLocal.some(cn => cn.date === fn.date)) {
              combinedLocal.push(fn)
            }
          })
          setLocalNotes(combinedLocal)
          
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
              const matchingSub = findActiveSubscriptionForService(subs, serviceId)
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
          setRecurrenceDays(Array.from(days).sort()) 
        }).catch(() => {}).finally(() => setIsLoadingRecurrenceDays(false))
      } else {
        setRecurrenceDays([])
      }
    }
  }, [appointment, refreshTrigger])

  const handleDelete = async () => {
    if (!appointment) return
    setIsDeleting(true)
    
    if (deleteMode === 'this-and-future') {
      const { deletedIds, error } = await deleteFutureAppointments(appointment.id)
      if (error) {
        toast({ title: 'Erro ao excluir agendamento', description: getFriendlyErrorMessage(error), variant: 'destructive' })
      } else {
        toast({ title: 'Agendamentos excluídos com sucesso!' })
        if (deletedIds && deletedIds.length > 0) {
          deletedIds.forEach(id => updateAppointmentCache(id, () => null))
        } else {
          updateAppointmentCache(appointment.id, () => null)
        }
        onAppointmentUpdated(true)
        onOpenChange(false)
      }
    } else {
      deleteMutation.mutate(appointment.id, {
        onSuccess: () => {
          toast({ title: 'Agendamento excluído com sucesso!' })
          updateAppointmentCache(appointment.id, () => null)
          onAppointmentUpdated(false)
          onOpenChange(false)
        },
        onError: (error) => {
          toast({ title: 'Erro ao excluir agendamento', description: getFriendlyErrorMessage(error), variant: 'destructive' })
        }
      })
    }
    setIsDeleting(false)
  }

  const handleStatusChange = (newStatus: string) => {
    if (!appointment) return
    setIsUpdatingStatus(true)
    setLocalStatus(newStatus)

    statusMutation.mutate({ appointmentId: appointment.id, status: newStatus }, {
      onSuccess: () => {
        toast({ title: 'Status atualizado com sucesso.' })
        updateAppointmentCache(appointment.id, (old) => ({ ...old, status: newStatus }))
        onAppointmentUpdated(false)
        setRefreshTrigger(prev => prev + 1)
        setIsUpdatingStatus(false)
      },
      onError: (error) => {
        setLocalStatus(appointment.status)
        toast({ title: 'Erro ao atualizar status', description: getFriendlyErrorMessage(error), variant: 'destructive' })
        setIsUpdatingStatus(false)
      }
    })
  }

  const handleAddNote = async () => {
    if (!newNote.trim() || !appointment) return
    setIsSavingNote(true)

    const noteEntry: Omit<NoteEntry, 'id'> & { date?: string } = {
      professional_id: professionalId || user?.id || undefined,
      professional_name: user?.displayName || user?.email || 'Administrador',
      content: newNote,
      type: 'evolution',
      appointment_id: appointment.id,
      date: appointment.schedules?.start_time
    }

    const { data, error } = await addClientNote((appointment as any).client_id, noteEntry)
    if (error) {
      toast({ title: 'Erro ao adicionar nota', description: getFriendlyErrorMessage(error), variant: 'destructive' })
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
    if (!appointment) return
    const val = parseFloat(discountValue)
    if (isNaN(val) || val < 0) {
      toast({ title: 'Valor inválido', description: 'O desconto deve ser um número positivo.', variant: 'destructive' })
      return
    }

    setIsSavingDiscount(true)
    const { error } = await updateAppointment(appointment.id, { discount_amount: val })

    if (error) {
      toast({ title: 'Erro ao atualizar desconto', description: getFriendlyErrorMessage(error), variant: 'destructive' })
    } else {
      toast({ title: 'Desconto atualizado com sucesso!' })
      setIsEditingDiscount(false)
      updateAppointmentCache(appointment.id, (old) => ({ ...old, discount_amount: val }))
      onAppointmentUpdated(false)
    }
    setIsSavingDiscount(false)
  }

  const startTime = appointment?.schedules?.start_time || ''
  const isEvent = appointment ? isClinicEvent(appointment) : false
  const duration = isEvent
    ? (appointment?.event_duration_minutes || 60)
    : (appointment?.services?.duration_minutes || 30)
  const calculatedEndTime = startTime ? addMinutes(new Date(startTime), duration) : new Date()

  const clientPackageId = appointment ? (appointment as any).client_package_id : null
  const serviceValueType = appointment ? (appointment.services as any)?.value_type : null

  const isPackage = !!clientPackageId
  const isMonthlySubscription = serviceValueType === 'monthly' || !!subscriptionDetails
  const isZeroCost = isPackage || isMonthlySubscription

  const servicePrice = appointment?.services?.price || 0
  const currentDiscount = parseFloat(discountValue) || 0
  const finalPrice = isZeroCost ? 0 : Math.max(0, servicePrice - currentDiscount)

  const displayStatus = localStatus || appointment?.status || 'scheduled'
  const canEdit = ['scheduled'].includes(displayStatus)
  const isAdmin = role === 'admin'
  const isOwnAppointment = appointment?.professional_id === professionalId
  const canUpdateAllStatuses = config?.roles?.[role || 'professional']?.features?.includes('update_all_statuses')
  const canChangeStatus = isAdmin || isOwnAppointment || !!canUpdateAllStatuses
  const canReschedule = isAdmin || config?.roles?.[role || 'professional']?.features?.includes('reschedule')
  const canViewFinancials = isAdmin || config?.roles?.[role || 'professional']?.features?.includes('view_financials')

  return {
    state: {
      isDeleting,
      isUpdatingStatus,
      isRescheduleOpen,
      newNote,
      isSavingNote,
      localStatus,
      localNotes,
      lastNotes,
      hasMoreNotes,
      isLoadingLastNotes,
      deleteMode,
      packageDetails,
      subscriptionDetails,
      recurrenceDays,
      isLoadingRecurrenceDays,
      isEditingDiscount,
      discountValue,
      isSavingDiscount,
      isHistoryModalOpen,
      displayStatus,
      canEdit,
      isAdmin,
      canChangeStatus,
      canReschedule,
      canViewFinancials,
      startTime,
      duration,
      calculatedEndTime,
      isEvent,
      isPackage,
      isMonthlySubscription,
      isZeroCost,
      servicePrice,
      currentDiscount,
      finalPrice,
    },
    actions: {
      setIsRescheduleOpen,
      setNewNote,
      setDeleteMode,
      setIsEditingDiscount,
      setDiscountValue,
      setIsHistoryModalOpen,
      handleDelete,
      handleStatusChange,
      handleAddNote,
      handleSaveDiscount,
      handleRescheduleSuccess: (shouldInvalidate?: boolean) => {
        onAppointmentUpdated(shouldInvalidate)
        onOpenChange(false)
      }
    }
  }
}

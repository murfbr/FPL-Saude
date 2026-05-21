import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as appointmentService from '../service'
import { Appointment } from '@/shared/types'

export const appointmentKeys = {
  all: ['appointments'] as const,
  lists: () => [...appointmentKeys.all, 'list'] as const,
  list: (filters: any) => [...appointmentKeys.lists(), { filters }] as const,
  ranges: () => [...appointmentKeys.all, 'range'] as const,
  range: (start: string, end: string, professionalId?: string) => [...appointmentKeys.ranges(), { start, end, professionalId }] as const,
  upcoming: () => [...appointmentKeys.all, 'upcoming'] as const,
  byClient: (clientId: string) => [...appointmentKeys.all, 'byClient', clientId] as const,
  byClientPaginated: (clientId: string, page: number) => [...appointmentKeys.all, 'byClientPaginated', clientId, page] as const,
}

export function useAppointmentsQuery(page: number, pageSize: number, filters: any) {
  return useQuery({
    queryKey: appointmentKeys.list({ page, pageSize, ...filters }),
    queryFn: async () => {
      const { data, count, error } = await appointmentService.getAppointmentsPaginated(page, pageSize, filters)
      if (error) throw error
      return { data: data as Appointment[], count }
    },
  })
}

export function useAppointmentsForRangeQuery(startDate: Date, endDate: Date, professionalId?: string) {
  return useQuery({
    queryKey: appointmentKeys.range(startDate.toISOString(), endDate.toISOString(), professionalId),
    queryFn: async () => {
      const { data, error } = await appointmentService.getAppointmentsForRange(startDate, endDate, professionalId)
      if (error) throw error
      return data as Appointment[]
    },
    enabled: !!startDate && !!endDate,
  })
}

export function useUpcomingAppointmentsQuery() {
  return useQuery({
    queryKey: appointmentKeys.upcoming(),
    queryFn: async () => {
      const { data, error } = await appointmentService.getUpcomingAppointments()
      if (error) throw error
      return data as Appointment[]
    },
  })
}

export function useAppointmentsByClientQuery(clientId: string) {
  return useQuery({
    queryKey: appointmentKeys.byClient(clientId),
    queryFn: async () => {
      const { data, error } = await appointmentService.getAppointmentsByClientId(clientId)
      if (error) throw error
      return data as Appointment[]
    },
    enabled: !!clientId,
  })
}

export function useBookAppointmentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { professionalId: string; clientId: string; serviceId: string; startTime: string; clientPackageId?: string; isRecurring?: boolean; discountAmount?: number }) => {
      const { data, error } = await appointmentService.bookAppointment(
        params.professionalId, params.clientId, params.serviceId, params.startTime, params.clientPackageId, params.isRecurring, params.discountAmount
      )
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all })
    },
  })
}

export function useUpdateAppointmentStatusMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { appointmentId: string; status: string }) => {
      const { error } = await appointmentService.updateAppointmentStatus(params.appointmentId, params.status)
      if (error) throw error
      return params
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all })
    },
  })
}

export function useDeleteAppointmentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { deletedIds, error } = await appointmentService.deleteAppointment(id)
      if (error) throw error
      return deletedIds
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all })
    },
  })
}

export function useRescheduleAppointmentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { appointmentId: string; newProfessionalId: string; newStartTime: string }) => {
      const { error } = await appointmentService.rescheduleAppointment(params.appointmentId, params.newProfessionalId, params.newStartTime)
      if (error) throw error
      return params
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentKeys.all })
    },
  })
}

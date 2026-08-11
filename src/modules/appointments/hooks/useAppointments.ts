import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as appointmentService from '../service'
import { invalidateAppointmentQueries } from '../queries'

/**
 * Mutações de agendamento.
 *
 * Custo de reads: cada query de range refeita cobra 1 read por documento do
 * período (um mês pode ter centenas). Por isso a invalidação aqui é cirúrgica:
 * - criar: invalida apenas as queries de range que contêm a data do novo
 *   agendamento (invalidateAppointmentQueries com range)
 * - status/excluir: nenhuma invalidação — o chamador atualiza o cache pontualmente
 *   via useUpdateAppointmentCache (contrato seguido por AppointmentDetailDialog)
 */

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
    onSuccess: (_data, variables) => {
      invalidateAppointmentQueries(queryClient, {
        from: variables.startTime,
        to: variables.isRecurring ? undefined : variables.startTime,
      })
    },
  })
}

export function useUpdateAppointmentStatusMutation() {
  return useMutation({
    mutationFn: async (params: { appointmentId: string; status: string; options?: { allowExhaustedPackageUse?: boolean } }) => {
      const { error } = await appointmentService.updateAppointmentStatus(params.appointmentId, params.status, params.options)
      if (error) throw error
      return params
    },
  })
}

export function useDeleteAppointmentMutation() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { deletedIds, error } = await appointmentService.deleteAppointment(id)
      if (error) throw error
      return deletedIds
    },
  })
}

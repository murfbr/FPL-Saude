/**
 * Hooks TanStack Query para o módulo de agendamentos.
 *
 * Centralizam cache, staleTime e invalidação automática.
 * Os componentes de agenda (Day, Week, Calendar) compartilham a mesma
 * cache key baseada em [range + professionalId], eliminando re-fetches
 * ao navegar entre views que cobrem o mesmo período.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAppointmentsForRange,
  getUpcomingAppointments,
} from '@/modules/appointments/service'
import { Appointment } from '@/shared/types'
import { useAuth } from '@/shared/providers/AuthProvider'

/** Chave padrão para queries de appointments */
const APPOINTMENTS_KEY = 'appointments'

/**
 * Hook para buscar agendamentos em um range de datas.
 * Cache de 60s — evita re-fetch ao alternar entre views (dia/semana/mês)
 * que cobrem períodos sobrepostos.
 */
export const useAppointmentsForRange = (
  startDate: Date,
  endDate: Date,
  professionalId?: string,
  options?: { enabled?: boolean },
) => {
  const { companyId } = useAuth()

  return useQuery({
    queryKey: [
      APPOINTMENTS_KEY,
      'range',
      companyId,
      startDate.toISOString(),
      endDate.toISOString(),
      professionalId || 'all',
    ],
    queryFn: async () => {
      const { data, error } = await getAppointmentsForRange(
        startDate,
        endDate,
        professionalId,
      )
      if (error) throw error
      return data || []
    },
    staleTime: 60_000, // 1 minuto
    enabled: options?.enabled !== false && !!companyId,
  })
}

/**
 * Hook para próximos agendamentos (dashboard widget).
 * Cache de 2 minutos — dados menos críticos.
 */
export const useUpcomingAppointments = () => {
  const { companyId } = useAuth()

  return useQuery({
    queryKey: [APPOINTMENTS_KEY, 'upcoming', companyId],
    queryFn: async () => {
      const { data, error } = await getUpcomingAppointments()
      if (error) throw error
      return data || []
    },
    staleTime: 2 * 60_000, // 2 minutos
    enabled: !!companyId,
  })
}

/**
 * Hook auxiliar para atualizar um único agendamento no cache.
 * Evita fazer um refetch de todos os agendamentos do dia/semana/mês.
 */
export const useUpdateAppointmentCache = () => {
  const queryClient = useQueryClient()

  return (appointmentId: string, updater: (oldAppt: Appointment) => Appointment | null) => {
    // Atualiza o agendamento em TODAS as queries de appointments ativas
    queryClient.setQueriesData({ queryKey: [APPOINTMENTS_KEY] }, (oldData: Appointment[] | undefined) => {
      if (!oldData) return oldData
      
      const index = oldData.findIndex(a => a.id === appointmentId)
      if (index === -1) return oldData

      const oldAppt = oldData[index]
      const newAppt = updater(oldAppt)

      if (newAppt === null) {
        // Remover do cache
        return oldData.filter(a => a.id !== appointmentId)
      }

      // Atualizar no cache
      const newData = [...oldData]
      newData[index] = newAppt
      return newData
    })
  }
}

/**
 * Hook auxiliar para invalidar queries de appointments.
 * Chamar após mutações (criar, editar, deletar, mudar status).
 */
export const useInvalidateAppointments = () => {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] })
  }
}

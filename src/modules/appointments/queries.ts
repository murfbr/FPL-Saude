/**
 * Hooks TanStack Query para o módulo de agendamentos.
 *
 * Centralizam cache, staleTime e invalidação automática.
 * Os componentes de agenda (Day, Week, Calendar) compartilham a mesma
 * cache key baseada em [range + professionalId], eliminando re-fetches
 * ao navegar entre views que cobrem o mesmo período.
 */
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  getAppointmentsForRange,
  getUpcomingAppointments,
} from '@/modules/appointments/service'
import { Appointment } from '@/shared/types'
import { useAuth } from '@/shared/providers/AuthProvider'

/** Chave padrão para queries de appointments */
const APPOINTMENTS_KEY = 'appointments'

/**
 * Janela de datas afetada por uma mutação, em ISO UTC (mesmo formato de
 * schedules.start_time). `from`/`to` omitidos significam "sem limite" naquele lado.
 */
export type AppointmentsRange = { from?: string; to?: string }

/**
 * Invalida queries de appointments. Com `range`, apenas as queries de período
 * cujo intervalo intersecta [from, to] são invalidadas — uma mutação pontual não
 * dispara refetch do mês inteiro em views que não contêm a data afetada.
 * Sem `range`, invalida tudo (fallback).
 *
 * A comparação lexicográfica de strings é segura porque todas as datas envolvidas
 * (keys de range e schedules.start_time) vêm de toISOString(), sempre em UTC.
 */
export function invalidateAppointmentQueries(
  queryClient: QueryClient,
  range?: AppointmentsRange,
) {
  if (!range || (!range.from && !range.to)) {
    queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] })
    return
  }
  const { from, to } = range
  queryClient.invalidateQueries({
    queryKey: [APPOINTMENTS_KEY],
    predicate: (query) => {
      // Shape das queries de período: [APPOINTMENTS_KEY, 'range', companyId, startISO, endISO, professionalId]
      const [, kind, , start, end] = query.queryKey
      if (kind === 'range' && typeof start === 'string' && typeof end === 'string') {
        return (!to || start <= to) && (!from || end >= from)
      }
      // Demais queries de appointments (upcoming etc.) são baratas — invalida sempre
      return true
    },
  })
}

/**
 * Hook para buscar agendamentos em um range de datas.
 * Cache longo (5min stale / 30min em memória) — cada doc retornado é 1 read no
 * Firestore, então navegar entre views/meses reaproveita o cache; mutações
 * atualizam via patch (useUpdateAppointmentCache) ou invalidação cirúrgica
 * (invalidateAppointmentQueries com range).
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
    staleTime: 5 * 60_000, // 5 minutos
    gcTime: 30 * 60_000, // 30 minutos
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
      if (!oldData || !Array.isArray(oldData)) return oldData
      
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
 * Passe o range afetado sempre que ele for conhecido — sem ele a invalidação é
 * total e cada view de agenda montada refaz o fetch do período inteiro.
 */
export const useInvalidateAppointments = () => {
  const queryClient = useQueryClient()

  return (range?: AppointmentsRange) => {
    invalidateAppointmentQueries(queryClient, range)
  }
}

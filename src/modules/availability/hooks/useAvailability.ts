import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as availabilityService from '../service'
import { RecurringAvailability, AvailabilityOverride, BlockedDate } from '@/shared/types'

export const availabilityKeys = {
  all: ['availability'] as const,
  recurring: (professionalId: string) => [...availabilityKeys.all, 'recurring', professionalId] as const,
  overrides: (professionalId: string, month: string) => [...availabilityKeys.all, 'overrides', professionalId, month] as const,
  overridesRange: (professionalId: string, start: string, end: string) => [...availabilityKeys.all, 'overridesRange', professionalId, start, end] as const,
  availableDates: (professionalId: string, serviceId: string, start: string, end: string) => [...availabilityKeys.all, 'availableDates', professionalId, serviceId, start, end] as const,
  globalBlockedDates: () => [...availabilityKeys.all, 'globalBlockedDates'] as const,
}

export function useRecurringAvailabilityQuery(professionalId: string) {
  return useQuery({
    queryKey: availabilityKeys.recurring(professionalId),
    queryFn: async () => {
      const { data, error } = await availabilityService.getRecurringAvailability(professionalId)
      if (error) throw error
      return data as RecurringAvailability[]
    },
    enabled: !!professionalId,
  })
}

export function useAvailabilityOverridesQuery(professionalId: string, month: Date) {
  return useQuery({
    queryKey: availabilityKeys.overrides(professionalId, month.toISOString()),
    queryFn: async () => {
      const { data, error } = await availabilityService.getAvailabilityOverrides(professionalId, month)
      if (error) throw error
      return data as AvailabilityOverride[]
    },
    enabled: !!professionalId && !!month,
  })
}

export function useAvailableDatesForRangeQuery(professionalId: string, serviceId: string, startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: availabilityKeys.availableDates(professionalId, serviceId, startDate.toISOString(), endDate.toISOString()),
    queryFn: async () => {
      const { data, error } = await availabilityService.getAvailableDatesForRange(professionalId, serviceId, startDate, endDate)
      if (error) throw error
      return data as string[]
    },
    enabled: !!professionalId && !!serviceId && !!startDate && !!endDate,
  })
}

export function useGlobalBlockedDatesQuery() {
  return useQuery({
    queryKey: availabilityKeys.globalBlockedDates(),
    queryFn: async () => {
      const { data, error } = await availabilityService.getGlobalBlockedDates()
      if (error) throw error
      return data as BlockedDate[]
    },
  })
}

export function useSetRecurringAvailabilityMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ professionalId, availabilities }: { professionalId: string; availabilities: Omit<RecurringAvailability, 'id' | 'professional_id' | 'created_at'>[] }) => {
      const { error } = await availabilityService.setRecurringAvailability(professionalId, availabilities)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: availabilityKeys.recurring(variables.professionalId) })
      queryClient.invalidateQueries({ queryKey: availabilityKeys.all })
    },
  })
}

export function useAddAvailabilityOverrideMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (override: Omit<AvailabilityOverride, 'id' | 'created_at'>) => {
      const { data, error } = await availabilityService.addAvailabilityOverride(override)
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: availabilityKeys.overrides(variables.professional_id, '') }) // Simplification: we might need exact invalidation
      queryClient.invalidateQueries({ queryKey: availabilityKeys.all })
    },
  })
}

export function useBlockDayMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ professionalId, date }: { professionalId: string; date: Date }) => {
      const { error } = await availabilityService.blockDay(professionalId, date)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: availabilityKeys.all })
    },
  })
}

export function useRemoveDayOverridesMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ professionalId, date }: { professionalId: string; date: Date }) => {
      const { error } = await availabilityService.removeDayOverrides(professionalId, date)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: availabilityKeys.all })
    },
  })
}

export function useAddGlobalBlockedDateMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ date, type, reason }: { date: string; type: 'single' | 'annual'; reason: string | null }) => {
      const { data, error } = await availabilityService.addGlobalBlockedDate(date, type, reason)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: availabilityKeys.globalBlockedDates() })
    },
  })
}

export function useDeleteGlobalBlockedDateMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await availabilityService.deleteGlobalBlockedDate(id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: availabilityKeys.globalBlockedDates() })
    },
  })
}

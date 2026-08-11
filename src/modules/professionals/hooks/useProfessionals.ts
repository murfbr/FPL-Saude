import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as professionalService from '../service'
import { Professional } from '@/shared/types'

export const professionalKeys = {
  all: ['professionals'] as const,
  lists: () => [...professionalKeys.all, 'list'] as const,
  list: (filters: any) => [...professionalKeys.lists(), { filters }] as const,
  details: () => [...professionalKeys.all, 'detail'] as const,
  detail: (id: string) => [...professionalKeys.details(), id] as const,
  services: (id: string) => [...professionalKeys.detail(id), 'services'] as const,
  count: (filters: any) => [...professionalKeys.all, 'count', { filters }] as const,
}

export function useProfessionalsQuery(options?: { activeOnly?: boolean }) {
  return useQuery({
    queryKey: professionalKeys.list({ activeOnly: options?.activeOnly }),
    queryFn: async () => {
      const { data, error } = await professionalService.getAllProfessionals(options)
      if (error) throw error
      return data as Professional[]
    },
  })
}

export function useProfessionalsByServiceQuery(serviceId: string) {
  return useQuery({
    queryKey: professionalKeys.list({ serviceId }),
    queryFn: async () => {
      const { data, error } = await professionalService.getProfessionalsByService(serviceId)
      if (error) throw error
      return data as Professional[]
    },
    enabled: !!serviceId,
  })
}

export function useProfessionalDetailQuery(id: string) {
  return useQuery({
    queryKey: professionalKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await professionalService.getProfessionalById(id)
      if (error) throw error
      return data as Professional
    },
    enabled: !!id,
  })
}

export function useProfessionalServicesQuery(id: string) {
  return useQuery({
    queryKey: professionalKeys.services(id),
    queryFn: async () => {
      const { data, error } = await professionalService.getServicesByProfessional(id)
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useProfessionalsCountQuery(filter?: { status?: 'all' | 'active' | 'inactive' }) {
  return useQuery({
    queryKey: professionalKeys.count(filter),
    queryFn: async () => {
      const { count, error } = await professionalService.getProfessionalsCount(filter)
      if (error) throw error
      return count
    },
  })
}

export function useUpdateProfessionalMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<Professional, 'id' | 'created_at' | 'user_id'>> }) => {
      const { data, error } = await professionalService.updateProfessional(id, updates)
      if (error) throw error
      return data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: professionalKeys.all })
    },
  })
}

export function useAddServiceToProfessionalMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ professionalId, serviceId }: { professionalId: string; serviceId: string }) => {
      const { error } = await professionalService.addServiceToProfessional(professionalId, serviceId)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: professionalKeys.detail(variables.professionalId) })
      queryClient.invalidateQueries({ queryKey: professionalKeys.services(variables.professionalId) })
    },
  })
}

export function useRemoveServiceFromProfessionalMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ professionalId, serviceId }: { professionalId: string; serviceId: string }) => {
      const { error } = await professionalService.removeServiceFromProfessional(professionalId, serviceId)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: professionalKeys.detail(variables.professionalId) })
      queryClient.invalidateQueries({ queryKey: professionalKeys.services(variables.professionalId) })
    },
  })
}

export function useCreateProfessionalUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: any) => {
      const { data: result, error } = await professionalService.createProfessionalUser(data)
      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: professionalKeys.all })
    },
  })
}

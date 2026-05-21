import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as clientService from '../service'
import { Client } from '@/shared/types'

export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (filters: string) => [...clientKeys.lists(), { filters }] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
  byProfessional: (id: string) => [...clientKeys.all, 'professional', id] as const,
  birthdays: (start: string, end: string) => [...clientKeys.all, 'birthdays', start, end] as const,
}

export function useClientsQuery(filter?: { status?: 'all' | 'active' | 'inactive'; serviceId?: string }) {
  return useQuery({
    queryKey: clientKeys.list(JSON.stringify(filter || {})),
    queryFn: async () => {
      const { data, error } = await clientService.getAllClients(filter)
      if (error) throw error
      return data as Client[]
    },
  })
}

export function useClientQuery(id: string) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await clientService.getClientById(id)
      if (error) throw error
      return data as Client
    },
    enabled: !!id,
  })
}

export function useCreateClientMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (clientData: Omit<Client, 'id' | 'created_at' | 'user_id' | 'is_active'>) => {
      const { data, error } = await clientService.createClient(clientData)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
    },
  })
}

export function useUpdateClientMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Client> }) => {
      const { data, error } = await clientService.updateClient(id, updates)
      if (error) throw error
      return data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(variables.id) })
    },
  })
}

export function useDeleteClientMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await clientService.deleteClient(id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
    },
  })
}

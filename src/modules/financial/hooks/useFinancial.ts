import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as financialService from '../service'
import { ClientSubscription } from '@/shared/types'

export const financialKeys = {
  all: ['financial'] as const,
  invoiced: (start: string, end: string) => [...financialKeys.all, 'invoiced', { start, end }] as const,
  expected: () => [...financialKeys.all, 'expected'] as const,
  activeSubscriptions: (options?: any) => [...financialKeys.all, 'activeSubscriptions', options] as const,
  subscriptionPayments: (ids: string[], date: Date) => [...financialKeys.all, 'subscriptionPayments', { ids, date: date.toISOString() }] as const,
  packagePayments: (ids: string[]) => [...financialKeys.all, 'packagePayments', { ids }] as const,
}

export function useInvoicedValueQuery(startDate: string, endDate: string) {
  return useQuery({
    queryKey: financialKeys.invoiced(startDate, endDate),
    queryFn: async () => {
      const { data, error } = await financialService.getInvoicedValue(startDate, endDate)
      if (error) throw error
      return data
    },
    enabled: !!startDate && !!endDate,
  })
}

export function useExpectedRevenueQuery() {
  return useQuery({
    queryKey: financialKeys.expected(),
    queryFn: async () => {
      const { data, error } = await financialService.getExpectedRevenue()
      if (error) throw error
      return data
    },
  })
}

export function useActiveSubscriptionsQuery(options?: { limit?: number; targetDate?: Date }) {
  return useQuery({
    queryKey: financialKeys.activeSubscriptions(options),
    queryFn: async () => {
      const { data, error } = await financialService.getActiveSubscriptions(options)
      if (error) throw error
      return data as ClientSubscription[]
    },
  })
}

export function useSubscriptionPaymentsQuery(subscriptionIds: string[], monthDate: Date) {
  return useQuery({
    queryKey: financialKeys.subscriptionPayments(subscriptionIds, monthDate),
    queryFn: async () => {
      const { data, error } = await financialService.getSubscriptionPayments(subscriptionIds, monthDate)
      if (error) throw error
      return data
    },
    enabled: subscriptionIds.length > 0,
  })
}

export function usePackagePaymentsQuery(clientPackageIds: string[]) {
  return useQuery({
    queryKey: financialKeys.packagePayments(clientPackageIds),
    queryFn: async () => {
      const { data, error } = await financialService.getPackagePayments(clientPackageIds)
      if (error) throw error
      return data
    },
    enabled: clientPackageIds.length > 0,
  })
}

export function usePaySubscriptionMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ subscription, professionalId }: { subscription: ClientSubscription; professionalId: string }) => {
      const { error } = await financialService.paySubscription(subscription, professionalId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.all })
    },
  })
}

export function useDeleteSubscriptionPaymentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await financialService.deleteSubscriptionPayment(recordId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.all })
    },
  })
}

export function usePayPackageMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ clientPackage, professionalId }: { clientPackage: any; professionalId: string }) => {
      const { error } = await financialService.payPackage(clientPackage, professionalId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.all })
    },
  })
}

export function useDeletePackagePaymentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await financialService.deletePackagePayment(recordId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.all })
    },
  })
}

/**
 * Hooks TanStack Query para o módulo financeiro.
 *
 * Cache de subscriptions (5min) e summaries (10min) — dados que mudam
 * com pouca frequência durante uma sessão de uso.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getActiveSubscriptions,
  getSubscriptionPayments,
} from '@/modules/financial/service'
import { getMonthlySummary } from '@/modules/summaries/service'
import { useAuth } from '@/shared/providers/AuthProvider'

const FINANCIAL_KEY = 'financial'
const SUMMARIES_KEY = 'summaries'

/**
 * Hook para sumário mensal.
 * Cache de 10 minutos — dados agregados que só mudam quando appointments
 * são completados ou financial_records são criados.
 */
export const useMonthlySummary = (month: Date) => {
  const { companyId } = useAuth()

  return useQuery({
    queryKey: [SUMMARIES_KEY, companyId, month.getFullYear(), month.getMonth()],
    queryFn: async () => {
      const { data, error } = await getMonthlySummary(month)
      if (error) throw error
      return data
    },
    staleTime: 10 * 60_000, // 10 minutos
    enabled: !!companyId,
  })
}

/**
 * Hook para assinaturas ativas.
 * Cache de 5 minutos — lista de subscriptions raramente muda intra-sessão.
 */
export const useActiveSubscriptions = (options?: { limit?: number }) => {
  const { companyId } = useAuth()

  return useQuery({
    queryKey: [FINANCIAL_KEY, 'subscriptions', companyId, options?.limit],
    queryFn: async () => {
      const { data, error } = await getActiveSubscriptions(options)
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60_000, // 5 minutos
    enabled: !!companyId,
  })
}

/**
 * Hook para pagamentos de subscriptions em um mês específico.
 * Cache de 5 minutos — depende de subscriptionIds e mês.
 */
export const useSubscriptionPayments = (
  subscriptionIds: string[],
  monthDate: Date,
) => {
  const { companyId } = useAuth()

  return useQuery({
    queryKey: [
      FINANCIAL_KEY,
      'subscription-payments',
      companyId,
      subscriptionIds.join(','),
      monthDate.getFullYear(),
      monthDate.getMonth(),
    ],
    queryFn: async () => {
      const { data, error } = await getSubscriptionPayments(
        subscriptionIds,
        monthDate,
      )
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60_000,
    enabled: !!companyId && subscriptionIds.length > 0,
  })
}

/**
 * Hook auxiliar para invalidar queries financeiras.
 * Chamar após mutações (pagamento, estorno).
 */
export const useInvalidateFinancial = () => {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: [FINANCIAL_KEY] })
    queryClient.invalidateQueries({ queryKey: [SUMMARIES_KEY] })
  }
}

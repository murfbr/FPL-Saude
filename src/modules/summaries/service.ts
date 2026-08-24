import { db } from '@/shared/lib/firebase'
import { doc, getDoc, getDocs, collection } from 'firebase/firestore'
import { format } from 'date-fns'
import { getCompanyId } from '@/shared/lib/tenantStore'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Semântica dos campos de valor (mesma de functions/src/shared/summaryCore.ts):
 *   revenue          → caixa avulso (preço efetivo das sessões independentes)
 *   production_value → produção (preço efetivo de TODA sessão concluída)
 * Campos novos são opcionais: documentos anteriores à migração não os têm.
 */
export interface SummaryBreakdownStats {
  completed?: number
  cancelled?: number
  no_show?: number
  revenue?: number
  production_value?: number
  package_sessions?: number
  subscription_sessions?: number
  independent_sessions?: number
  independent_revenue?: number
}

export interface MonthlySummary {
  month: string // 'YYYY-MM'
  updated_at?: any

  // KPIs gerais
  total_revenue: number
  total_production_value?: number
  total_expenses?: number
  expenses_by_category?: Record<string, { name: string; total: number }>
  completed_appointments: number
  cancelled_appointments: number
  no_show_appointments: number
  total_appointments: number

  // Financeiro (assinaturas)
  subscriptions_revenue_received: number
  subscriptions_paid_count: number

  // Breakdowns
  by_professional: Record<string, SummaryBreakdownStats & { name: string }>
  by_service: Record<
    string,
    SummaryBreakdownStats & { name: string; count?: number }
  >
  by_partnership: Record<
    string,
    SummaryBreakdownStats & {
      name: string
      clientCount?: number
      sessionCount?: number
    }
  >
  by_professional_service?: Record<string, SummaryBreakdownStats>
  by_professional_partnership?: Record<string, SummaryBreakdownStats>
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function emptyMonthSummary(month: string): MonthlySummary {
  return {
    month,
    total_revenue: 0,
    total_production_value: 0,
    total_expenses: 0,
    expenses_by_category: {},
    completed_appointments: 0,
    cancelled_appointments: 0,
    no_show_appointments: 0,
    total_appointments: 0,
    subscriptions_revenue_received: 0,
    subscriptions_paid_count: 0,
    by_professional: {},
    by_service: {},
    by_partnership: {},
    by_professional_service: {},
    by_professional_partnership: {},
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lê 1 documento de sumário mensal.
 * Retorna um objeto vazio (zeros) se ainda não existir (ex: mês sem dados).
 */
export async function getMonthlySummary(
  month: Date,
): Promise<{ data: MonthlySummary; error: any }> {
  try {
    const monthKey = format(month, 'yyyy-MM')
    const ref = doc(
      db,
      'companies',
      getCompanyId(),
      'monthly_summaries',
      monthKey,
    )
    const snap = await getDoc(ref)

    if (!snap.exists()) {
      return { data: emptyMonthSummary(monthKey), error: null }
    }

    return {
      data: { month: monthKey, ...snap.data() } as MonthlySummary,
      error: null,
    }
  } catch (error) {
    return { data: emptyMonthSummary(format(month, 'yyyy-MM')), error }
  }
}

/**
 * Lê múltiplos sumários mensais em paralelo.
 * Ideal para o comparativo anual (12 reads simultâneos em vez de loop sequencial).
 */
export async function getMultipleMonthlySummaries(
  months: Date[],
): Promise<{ data: MonthlySummary[]; error: any }> {
  try {
    const refs = months.map((month) => {
      const monthKey = format(month, 'yyyy-MM')
      return doc(db, 'companies', getCompanyId(), 'monthly_summaries', monthKey)
    })

    const snaps = await Promise.all(refs.map((ref) => getDoc(ref)))

    const data = snaps.map((snap, i) => {
      const monthKey = format(months[i], 'yyyy-MM')
      if (!snap.exists()) return emptyMonthSummary(monthKey)
      return { month: monthKey, ...snap.data() } as MonthlySummary
    })

    return { data, error: null }
  } catch (error) {
    return { data: [], error }
  }
}

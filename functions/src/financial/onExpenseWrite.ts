import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { REGION, ServerTs, Inc } from '../config'
import { monthKeyOf, summaryRef } from '../shared/helpers'
import type { firestore } from 'firebase-admin'

/**
 * Mantém total_expenses e expenses_by_category do monthly_summary a partir
 * das despesas. Regime de caixa (mesma régua do total_revenue): só despesa
 * com status 'paid' conta, no mês (America/Sao_Paulo) do payment_date.
 * O cron diário reconcilia integralmente via summaryCore — este trigger é o
 * espelho incremental, como onFinancialRecordWrite é para as entradas.
 */

const paidMonth = (data: firestore.DocumentData | undefined): string | null => {
  if (!data || data.status !== 'paid' || !data.payment_date) return null
  return monthKeyOf(data.payment_date as string)
}

const categoryEntry = (
  data: firestore.DocumentData,
  amountDelta: number,
): Record<string, any> => ({
  [(data.category_id as string) || 'sem-categoria']: {
    name: (data.category_name as string) || 'Sem categoria',
    total: Inc(amountDelta),
  },
})

export const onExpenseWrite = onDocumentWritten(
  {
    document: 'companies/{companyId}/expenses/{expenseId}',
    region: REGION,
  },
  async (event) => {
    const companyId = event.params.companyId
    const before = event.data?.before?.data()
    const after = event.data?.after?.data()

    const bMonth = paidMonth(before)
    const aMonth = paidMonth(after)
    if (!bMonth && !aMonth) return

    const bAmount = (before?.amount as number) || 0
    const aAmount = (after?.amount as number) || 0

    // Mesmo mês pago → delta líquido (valor e/ou categoria podem ter mudado)
    if (bMonth && aMonth && bMonth === aMonth) {
      const sameCategory =
        (before?.category_id || null) === (after?.category_id || null)
      const diff = aAmount - bAmount
      if (diff === 0 && sameCategory) return

      const updates: Record<string, any> = {
        updated_at: ServerTs(),
        month: aMonth,
      }
      if (diff !== 0) updates.total_expenses = Inc(diff)
      updates.expenses_by_category = sameCategory
        ? categoryEntry(after!, diff)
        : {
            ...categoryEntry(before!, -bAmount),
            ...categoryEntry(after!, aAmount),
          }

      await summaryRef(companyId, aMonth).set(updates, { merge: true })
      return
    }

    // Transições: pagou / despagou / mudou o mês do pagamento
    const writes: Promise<any>[] = []
    if (bMonth) {
      writes.push(
        summaryRef(companyId, bMonth).set(
          {
            updated_at: ServerTs(),
            month: bMonth,
            total_expenses: Inc(-bAmount),
            expenses_by_category: categoryEntry(before!, -bAmount),
          },
          { merge: true },
        ),
      )
    }
    if (aMonth) {
      writes.push(
        summaryRef(companyId, aMonth).set(
          {
            updated_at: ServerTs(),
            month: aMonth,
            total_expenses: Inc(aAmount),
            expenses_by_category: categoryEntry(after!, aAmount),
          },
          { merge: true },
        ),
      )
    }
    await Promise.all(writes)
  },
)

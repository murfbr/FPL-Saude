import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { REGION, ServerTs, Inc } from '../config'
import { monthKeyOf, summaryRef } from '../shared/helpers'
import type { firestore } from 'firebase-admin'

export const onFinancialRecordWrite = onDocumentWritten(
  {
    document: 'companies/{companyId}/financial_records/{recordId}',
    region: REGION,
  },
  async (event) => {
    const companyId = event.params.companyId
    const before = event.data?.before?.data()
    const after = event.data?.after?.data()

    const bDate = before?.payment_date as string | undefined
    const aDate = after?.payment_date as string | undefined
    const bMonth = bDate ? monthKeyOf(bDate) : null
    const aMonth = aDate ? monthKeyOf(aDate) : null

    if (!bMonth && !aMonth) return

    // Helper: constroi delta de receita para um lado (+ ou -)
    const buildDelta = (
      data: firestore.DocumentData | undefined,
      sign: 1 | -1,
    ): Record<string, any> | null => {
      if (!data) return null
      const amount = (data.amount as number) || 0
      if (amount === 0) return null

      const u: Record<string, any> = {
        updated_at: ServerTs(),
        total_revenue: Inc(sign * amount),
      }

      if (data.client_subscription_id) {
        u.subscriptions_revenue_received = Inc(sign * amount)
        u.subscriptions_paid_count = Inc(sign)
      }

      return u
    }

    // Mesmo mês: calcula diferença líquida
    if (bMonth === aMonth && aMonth) {
      const bAmount = (before?.amount as number) || 0
      const aAmount = (after?.amount as number) || 0
      const diff = aAmount - bAmount

      const wasSub = !!before?.client_subscription_id
      const isSub = !!after?.client_subscription_id

      // Skip se nada mudou
      if (diff === 0 && wasSub === isSub) return

      const updates: Record<string, any> = {
        updated_at: ServerTs(),
        month: aMonth,
      }

      if (diff !== 0) updates.total_revenue = Inc(diff)

      // Tratar mudanças na flag de subscription
      if (wasSub && !isSub) {
        updates.subscriptions_revenue_received = Inc(-bAmount)
        updates.subscriptions_paid_count = Inc(-1)
      } else if (!wasSub && isSub) {
        updates.subscriptions_revenue_received = Inc(aAmount)
        updates.subscriptions_paid_count = Inc(1)
      } else if (wasSub && isSub && diff !== 0) {
        updates.subscriptions_revenue_received = Inc(diff)
      }

      await summaryRef(companyId, aMonth).set(updates, { merge: true })
      return
    }

    // Cross-month ou criação/deleção
    const writes: Promise<any>[] = []

    if (bMonth) {
      const removal = buildDelta(before, -1)
      if (removal) {
        removal.month = bMonth
        writes.push(
          summaryRef(companyId, bMonth).set(removal, { merge: true }),
        )
      }
    }

    if (aMonth) {
      const addition = buildDelta(after, 1)
      if (addition) {
        addition.month = aMonth
        writes.push(
          summaryRef(companyId, aMonth).set(addition, { merge: true }),
        )
      }
    }

    await Promise.all(writes)
  },
)

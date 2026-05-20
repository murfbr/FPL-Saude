import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { db, REGION, ServerTs, Inc } from '../config'
import { summaryRef } from '../shared/helpers'
import { format } from 'date-fns'

export const onSubscriptionWrite = onDocumentWritten(
  {
    document:
      'companies/{companyId}/clients/{clientId}/subscriptions/{subscriptionId}',
    region: REGION,
  },
  async (event) => {
    const companyId = event.params.companyId
    const before = event.data?.before?.data()
    const after = event.data?.after?.data()

    const wasActive = before?.status === 'active'
    const isActive = after?.status === 'active'

    // Se o estado ativo não mudou, não precisa atualizar expected revenue
    if (wasActive === isActive) return

    // Buscar preço do plano ou serviço (1 read)
    const sub = after || before
    let price = 0

    if (sub?.subscription_plan_id) {
      const planSnap = await db
        .collection('companies')
        .doc(companyId)
        .collection('subscription_plans')
        .doc(sub.subscription_plan_id as string)
        .get()
      price = (planSnap.data()?.price as number) || 0
    } else if (sub?.service_id) {
      const svcSnap = await db
        .collection('companies')
        .doc(companyId)
        .collection('services')
        .doc(sub.service_id as string)
        .get()
      price = (svcSnap.data()?.price as number) || 0
    }

    if (price === 0) return

    // Proration: se a assinatura começou neste mês, calcular proporcional
    const now = new Date()
    if (sub?.start_date) {
      const startDate = new Date(sub.start_date as string)
      const isSameMonth =
        startDate.getFullYear() === now.getFullYear() &&
        startDate.getMonth() === now.getMonth()
      if (isSameMonth) {
        const daysInMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
        ).getDate()
        const daysActive = daysInMonth - startDate.getDate() + 1
        price =
          Math.round(((price / daysInMonth) * daysActive * 100) / 100)
      }
    }

    const delta = isActive ? price : -price
    const monthKey = format(now, 'yyyy-MM')

    await summaryRef(companyId, monthKey).set(
      {
        updated_at: ServerTs(),
        month: monthKey,
        expected_subscriptions_revenue: Inc(delta),
      },
      { merge: true },
    )
  },
)

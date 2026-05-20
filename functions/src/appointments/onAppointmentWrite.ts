import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { REGION } from '../config'
import { monthKeyOf, summaryRef, appointmentDelta } from '../shared/helpers'

export const onAppointmentWrite = onDocumentWritten(
  {
    document: 'companies/{companyId}/appointments/{appointmentId}',
    region: REGION,
  },
  async (event) => {
    const companyId = event.params.companyId
    const before = event.data?.before?.data()
    const after = event.data?.after?.data()

    const bMonth = before?.schedules?.start_time
      ? monthKeyOf(before.schedules.start_time as string)
      : null
    const aMonth = after?.schedules?.start_time
      ? monthKeyOf(after.schedules.start_time as string)
      : null

    if (!bMonth && !aMonth) return

    // Caso comum: mesmo mês (criação, atualização de status, etc.)
    if (bMonth === aMonth && aMonth) {
      const delta = appointmentDelta(before, after)
      if (delta) {
        delta.month = aMonth
        await summaryRef(companyId, aMonth).set(delta, { merge: true })
      }
      return
    }

    // Cross-month: reagendamento entre meses ou criação/deleção
    const writes: Promise<any>[] = []

    if (bMonth) {
      // Remover do mês antigo (trata como deleção naquele mês)
      const removal = appointmentDelta(before, undefined)
      if (removal) {
        removal.month = bMonth
        writes.push(
          summaryRef(companyId, bMonth).set(removal, { merge: true }),
        )
      }
    }

    if (aMonth) {
      // Adicionar no mês novo (trata como criação naquele mês)
      const addition = appointmentDelta(undefined, after)
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

import { db } from '@/shared/lib/firebase'
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore'
import { ClientSubscription } from '@/shared/types'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { getCompanyId } from '@/shared/lib/tenantStore'

export async function paySubscription(subscription: ClientSubscription, professionalId: string, referenceDate?: Date): Promise<{ error: any }> {
  try {
    const reference = referenceDate || new Date()
    
    // Verifica duplicidade no mês de referência
    const start = startOfMonth(reference).toISOString()
    const end = endOfMonth(reference).toISOString()
    
    const finRef = collection(db, 'companies', getCompanyId(), 'financial_records')
    const duplicateQuery = query(finRef, where('client_subscription_id', '==', subscription.id))
    const duplicateSnap = await getDocs(duplicateQuery)
    
    let isDuplicate = false
    duplicateSnap.forEach(d => {
      const p = d.data()
      if (p.payment_date >= start && p.payment_date <= end) {
        isDuplicate = true
      }
    })

    if (isDuplicate) {
      return { error: new Error('Esta mensalidade já foi quitada para o mês selecionado.') }
    }

    const fullPrice = subscription.subscription_plans?.price || subscription.services?.price || 0
    const planName = subscription.subscription_plans?.name || subscription.services?.name || ''

    let amount = fullPrice
    let description = `Mensalidade ${planName} - ${format(reference, 'MM/yyyy')}`

    // Prorated billing: check if the subscription started in the current billing month
    if (subscription.start_date) {
      const startDate = new Date(subscription.start_date)
      const isSameMonthAsStart =
        startDate.getFullYear() === reference.getFullYear() &&
        startDate.getMonth() === reference.getMonth()

      if (isSameMonthAsStart) {
        // Calculate proration: days from start_date to end of month
        const daysInMonth = new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate()
        const startDay = startDate.getDate()
        const daysActive = daysInMonth - startDay + 1 // inclusive of start day

        amount = Math.round((fullPrice / daysInMonth) * daysActive * 100) / 100
        description = `Mensalidade ${planName} - ${format(reference, 'MM/yyyy')} (proporcional: ${daysActive}/${daysInMonth} dias — R$ ${fullPrice.toFixed(2)}/mês)`
      }
    }

    const newDoc = doc(finRef)
    await setDoc(newDoc, {
      id: newDoc.id,
      client_id: subscription.client_id,
      professional_id: professionalId,
      client_subscription_id: subscription.id,
      amount: amount,
      payment_date: reference.toISOString(),
      description: description,
      payment_method: 'manual',
    })
    return { error: null }
  } catch (error) { return { error } }
}

export async function deleteSubscriptionPayment(recordId: string): Promise<{ error: any }> {
  try {
    await deleteDoc(doc(db, 'companies', getCompanyId(), 'financial_records', recordId))
    return { error: null }
  } catch (error) { return { error } }
}

export async function payPackage(clientPackage: any, professionalId: string): Promise<{ error: any }> {
  try {
    console.log('[payPackage] Input:', { clientPackage, professionalId })
    const amount = (clientPackage.packages?.price || 0) - (clientPackage.discount_amount || 0)
    const description = `Pacote ${clientPackage.packages?.name || ''}`

    const finRef = collection(db, 'companies', getCompanyId(), 'financial_records')
    const newDoc = doc(finRef)
    const payload = {
      id: newDoc.id,
      client_id: clientPackage.client_id,
      professional_id: professionalId,
      client_package_id: clientPackage.id,
      amount: amount,
      payment_date: new Date().toISOString(),
      description: description,
      payment_method: 'manual',
    }
    console.log('[payPackage] Writing payload:', payload)
    await setDoc(newDoc, payload)
    console.log('[payPackage] Success!')
    return { error: null }
  } catch (error) {
    console.error('[payPackage] Error:', error)
    return { error }
  }
}

export async function deletePackagePayment(recordId: string): Promise<{ error: any }> {
  try {
    await deleteDoc(doc(db, 'companies', getCompanyId(), 'financial_records', recordId))
    return { error: null }
  } catch (error) { return { error } }
}

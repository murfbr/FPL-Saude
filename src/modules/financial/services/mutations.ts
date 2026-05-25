import { db } from '@/shared/lib/firebase'
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore'
import { ClientSubscription } from '@/shared/types'
import { format } from 'date-fns'
import { getCompanyId } from '@/shared/lib/tenantStore'

export async function paySubscription(subscription: ClientSubscription, professionalId: string): Promise<{ error: any }> {
  try {
    const fullPrice = subscription.subscription_plans?.price || subscription.services?.price || 0
    const planName = subscription.subscription_plans?.name || subscription.services?.name || ''
    const now = new Date()
    
    let amount = fullPrice
    let description = `Mensalidade ${planName} - ${format(now, 'MM/yyyy')}`

    // Prorated billing: check if the subscription started in the current billing month
    if (subscription.start_date) {
      const startDate = new Date(subscription.start_date)
      const isSameMonthAsStart =
        startDate.getFullYear() === now.getFullYear() &&
        startDate.getMonth() === now.getMonth()

      if (isSameMonthAsStart) {
        // Calculate proration: days from start_date to end of month
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        const startDay = startDate.getDate()
        const daysActive = daysInMonth - startDay + 1 // inclusive of start day

        amount = Math.round((fullPrice / daysInMonth) * daysActive * 100) / 100
        description = `Mensalidade ${planName} - ${format(now, 'MM/yyyy')} (proporcional: ${daysActive}/${daysInMonth} dias — R$ ${fullPrice.toFixed(2)}/mês)`
      }
    }

    const finRef = collection(db, 'companies', getCompanyId(), 'financial_records')
    const newDoc = doc(finRef)
    await setDoc(newDoc, {
      id: newDoc.id,
      client_id: subscription.client_id,
      professional_id: professionalId,
      client_subscription_id: subscription.id,
      amount: amount,
      payment_date: now.toISOString(),
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

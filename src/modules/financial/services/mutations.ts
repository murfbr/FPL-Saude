import { db } from '@/shared/lib/firebase'
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { ClientSubscription } from '@/shared/types'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { getCompanyId } from '@/shared/lib/tenantStore'
import {
  subscriptionBaseAmount,
  subscriptionChargeForMonth,
} from '@/shared/lib/subscriptionBilling'

export async function paySubscription(
  subscription: ClientSubscription,
  professionalId: string,
  referenceDate?: Date,
): Promise<{ error: any }> {
  try {
    const reference = referenceDate || new Date()

    // Verifica duplicidade no mês de referência
    const start = startOfMonth(reference).toISOString()
    const end = endOfMonth(reference).toISOString()

    const finRef = collection(
      db,
      'companies',
      getCompanyId(),
      'financial_records',
    )
    const duplicateQuery = query(
      finRef,
      where('client_subscription_id', '==', subscription.id),
    )
    const duplicateSnap = await getDocs(duplicateQuery)

    let isDuplicate = false
    duplicateSnap.forEach((d) => {
      const p = d.data()
      if (p.payment_date >= start && p.payment_date <= end) {
        isDuplicate = true
      }
    })

    if (isDuplicate) {
      return {
        error: new Error(
          'Esta mensalidade já foi quitada para o mês selecionado.',
        ),
      }
    }

    // Valor e pro-rata vêm do helper compartilhado (mesma conta da tela):
    // amount negociado → preço de tabela − discount_amount; pro-rata por data
    // de calendário no mês de início
    const planName =
      subscription.subscription_plans?.name || subscription.services?.name || ''
    const base = subscriptionBaseAmount(subscription)
    const { amount, proration } = subscriptionChargeForMonth(
      subscription,
      reference,
    )

    const description = proration
      ? `Mensalidade ${planName} - ${format(reference, 'MM/yyyy')} (proporcional: ${proration.daysActive}/${proration.daysInMonth} dias — R$ ${base.toFixed(2)}/mês)`
      : `Mensalidade ${planName} - ${format(reference, 'MM/yyyy')}`

    // ID determinístico por assinatura+mês: mesmo numa corrida de dois cliques,
    // o segundo write sobrescreve o mesmo doc — duplicata é fisicamente impossível
    const newDoc = doc(
      finRef,
      `${subscription.id}_${format(reference, 'yyyy-MM')}`,
    )
    await setDoc(newDoc, {
      id: newDoc.id,
      client_id: subscription.client_id,
      professional_id: professionalId,
      client_subscription_id: subscription.id,
      amount: amount,
      payment_date: reference.toISOString(),
      description: description,
      payment_method: 'manual',
      created_at: new Date().toISOString(),
      created_by: professionalId || null,
    })
    return { error: null }
  } catch (error) {
    return { error }
  }
}

/**
 * Estorno com trilha de auditoria: grava um snapshot completo do registro em
 * financial_audit (append-only) antes de removê-lo. A remoção física é mantida
 * porque o trigger onFinancialRecordWrite entende deleção e decrementa o
 * monthly_summary corretamente.
 */
async function archiveAndDeleteFinancialRecord(
  recordId: string,
  reversedBy?: string,
): Promise<{ error: any }> {
  try {
    const companyId = getCompanyId()
    const recordRef = doc(
      db,
      'companies',
      companyId,
      'financial_records',
      recordId,
    )
    const snap = await getDoc(recordRef)
    if (!snap.exists()) {
      return { error: new Error('Registro financeiro não encontrado.') }
    }

    const auditRef = doc(
      collection(db, 'companies', companyId, 'financial_audit'),
    )
    await setDoc(auditRef, {
      id: auditRef.id,
      action: 'reversal',
      record_id: recordId,
      record: snap.data(),
      reversed_by: reversedBy || null,
      reversed_at: new Date().toISOString(),
    })

    await deleteDoc(recordRef)
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function deleteSubscriptionPayment(
  recordId: string,
  reversedBy?: string,
): Promise<{ error: any }> {
  return archiveAndDeleteFinancialRecord(recordId, reversedBy)
}

export async function payPackage(
  clientPackage: any,
  professionalId: string,
): Promise<{ error: any }> {
  try {
    const finRef = collection(
      db,
      'companies',
      getCompanyId(),
      'financial_records',
    )

    // Pagamentos legados têm IDs aleatórios — a checagem por query cobre esses casos
    const duplicateQuery = query(
      finRef,
      where('client_package_id', '==', clientPackage.id),
    )
    const duplicateSnap = await getDocs(duplicateQuery)
    if (!duplicateSnap.empty) {
      return {
        error: new Error('Este pacote já possui um pagamento registrado.'),
      }
    }

    const amount =
      (clientPackage.packages?.price || 0) -
      (clientPackage.discount_amount || 0)
    const description = `Pacote ${clientPackage.packages?.name || ''}`

    // ID determinístico = client_package_id: corrida de dois cliques sobrescreve
    // o mesmo doc em vez de duplicar
    const newDoc = doc(finRef, clientPackage.id)
    await setDoc(newDoc, {
      id: newDoc.id,
      client_id: clientPackage.client_id,
      professional_id: professionalId,
      client_package_id: clientPackage.id,
      amount: amount,
      payment_date: new Date().toISOString(),
      description: description,
      payment_method: 'manual',
      created_at: new Date().toISOString(),
      created_by: professionalId || null,
    })
    return { error: null }
  } catch (error) {
    console.error('[payPackage] Error:', error)
    return { error }
  }
}

export async function deletePackagePayment(
  recordId: string,
  reversedBy?: string,
): Promise<{ error: any }> {
  return archiveAndDeleteFinancialRecord(recordId, reversedBy)
}

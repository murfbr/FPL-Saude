import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { db, REGION, ServerTs } from '../config'

/**
 * Espelhos (índices) de assinaturas e pacotes dos pacientes em coleções
 * planas por empresa:
 *   companies/{id}/subscriptions_index/{subId}
 *   companies/{id}/client_packages_index/{pkgId}
 *
 * Motivo: as telas de cobrança (Gestão Financeira / Gestão de Pacotes) liam
 * clients × subcoleções (~1.000 reads por abertura). Com o índice, viram uma
 * query única. O espelho é mantido aqui — qualquer caminho de escrita
 * (telas, cascata de arquivamento, scripts) sincroniza automaticamente.
 * Somente as Functions escrevem nos índices (rules bloqueiam o client).
 */

async function clientSnapshotFields(companyId: string, clientId: string) {
  const clientSnap = await db
    .collection('companies')
    .doc(companyId)
    .collection('clients')
    .doc(clientId)
    .get()
  return {
    client_name: (clientSnap.data()?.name as string) || '',
    client_email: (clientSnap.data()?.email as string) || '',
  }
}

export const onClientSubscriptionWrite = onDocumentWritten(
  {
    document: 'companies/{companyId}/clients/{clientId}/subscriptions/{subId}',
    region: REGION,
  },
  async (event) => {
    const { companyId, clientId, subId } = event.params
    const after = event.data?.after?.data()

    const indexRef = db
      .collection('companies')
      .doc(companyId)
      .collection('subscriptions_index')
      .doc(subId)

    if (!after) {
      await indexRef.delete()
      return
    }

    const client = await clientSnapshotFields(companyId, clientId)
    await indexRef.set({
      id: subId,
      client_id: clientId,
      ...client,
      service_id: after.service_id || null,
      subscription_plan_id: after.subscription_plan_id || null,
      start_date: after.start_date || null,
      end_date: after.end_date || null,
      cancelled_at: after.cancelled_at || null,
      status: after.status || null,
      amount: after.amount ?? null,
      discount_amount: after.discount_amount ?? null,
      created_at: after.created_at || null,
      indexed_at: ServerTs(),
    })
  },
)

export const onClientPackageWrite = onDocumentWritten(
  {
    document: 'companies/{companyId}/clients/{clientId}/packages/{pkgId}',
    region: REGION,
  },
  async (event) => {
    const { companyId, clientId, pkgId } = event.params
    const after = event.data?.after?.data()

    const indexRef = db
      .collection('companies')
      .doc(companyId)
      .collection('client_packages_index')
      .doc(pkgId)

    if (!after) {
      await indexRef.delete()
      return
    }

    const client = await clientSnapshotFields(companyId, clientId)
    await indexRef.set({
      id: pkgId,
      client_id: clientId,
      ...client,
      package_id: after.package_id || null,
      purchase_date: after.purchase_date || null,
      sessions_remaining: after.sessions_remaining ?? 0,
      discount_amount: after.discount_amount ?? null,
      status: after.status || null,
      indexed_at: ServerTs(),
    })
  },
)

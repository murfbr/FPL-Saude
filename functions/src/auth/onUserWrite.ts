import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { REGION } from '../config'
import * as admin from 'firebase-admin'

export const onUserWrite = onDocumentWritten(
  {
    document: 'users/{uid}',
    region: REGION,
  },
  async (event) => {
    const uid = event.params.uid
    const after = event.data?.after?.data() as any

    // O ciclo de vida do acesso (congelar/reativar conta) é responsabilidade da
    // callable setStaffActive — este trigger NÃO deleta mais contas de Auth nem
    // anonimiza o cadastro do profissional. Histórico é sempre preservado.
    if (!after) return

    const { companyId, role } = after

    if (!companyId || !role) {
      console.log(`User ${uid} is missing companyId or role. Skipping custom claims.`)
      return
    }

    try {
      const userRecord = await admin.auth().getUser(uid)
      const currentClaims = userRecord.customClaims || {}

      if (currentClaims.companyId === companyId && currentClaims.role === role) {
        console.log(`User ${uid} already has the correct claims. Skipping.`)
        return
      }

      await admin.auth().setCustomUserClaims(uid, {
        ...currentClaims,
        companyId,
        role,
      })
      console.log(`Successfully set claims for user ${uid}: companyId=${companyId}, role=${role}`)
    } catch (error) {
      console.error(`Error setting custom claims for user ${uid}:`, error)
    }
  }
)

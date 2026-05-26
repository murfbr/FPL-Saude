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
    const before = event.data?.before?.data() as any

    const isSoftDeleted = after && after.is_active === false && before && before.is_active !== false
    const isHardDeleted = !after && before

    if (isSoftDeleted || isHardDeleted) {
      // Document deleted (hard or soft), we must delete the Auth user and clean up subcollections
      const userRef = isSoftDeleted ? after : before
      const { companyId, role, name } = userRef

      try {
        await admin.auth().deleteUser(uid)
        console.log(`Successfully deleted auth user ${uid}`)

        if (companyId && (role === 'professional' || role === 'admin')) {
          await admin.firestore()
            .collection('companies')
            .doc(companyId)
            .collection('professionals')
            .doc(uid)
            .set({
              is_active: false,
              name: name ? `${name} (Excluído)` : 'Usuário Excluído',
              email: '',
              avatar_url: ''
            }, { merge: true })
          console.log(`Cleaned up professional doc for ${uid}`)
        }
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          console.log(`Auth user ${uid} already deleted or not found.`)
        } else {
          console.error(`Error deleting auth user ${uid}:`, error)
        }
      }
      return
    }

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

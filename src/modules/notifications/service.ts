import { db } from '@/shared/lib/firebase'
import { Notification } from '@/shared/types'
import { collection, query, where, getDocs, doc, updateDoc, getCountFromServer } from 'firebase/firestore'

import { getCompanyId } from '@/shared/lib/tenantStore'

export type UnifiedNotification = Notification & { source: 'professional' | 'admin' }

export async function getNotifications(professionalId: string | null, adminId: string | null) {
  try {
    const promises = []
    
    if (professionalId) {
      const ref = collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'notifications')
      promises.push(getDocs(query(ref)).then(s => s.docs.map(d => ({ id: d.id, source: 'professional', ...d.data() } as UnifiedNotification))))
    }
    
    if (adminId) {
      const ref = collection(db, 'companies', getCompanyId(), 'admins', adminId, 'notifications')
      promises.push(getDocs(query(ref)).then(s => s.docs.map(d => ({ id: d.id, source: 'admin', ...d.data() } as UnifiedNotification))))
    }

    const results = await Promise.all(promises)
    const data = results.flat()
    data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getRecentUnreadNotifications(
  professionalId: string | null,
  adminId: string | null,
  limitNum = 3,
) {
  try {
    const promises = []
    
    if (professionalId) {
      const ref = collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'notifications')
      promises.push(getDocs(query(ref, where('is_read', '==', false))).then(s => s.docs.map(d => ({ id: d.id, source: 'professional', ...d.data() } as UnifiedNotification))))
    }
    
    if (adminId) {
      const ref = collection(db, 'companies', getCompanyId(), 'admins', adminId, 'notifications')
      promises.push(getDocs(query(ref, where('is_read', '==', false))).then(s => s.docs.map(d => ({ id: d.id, source: 'admin', ...d.data() } as UnifiedNotification))))
    }

    const results = await Promise.all(promises)
    let data = results.flat()

    // Sort in memory to avoid requiring a composite index in Firestore
    data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    data = data.slice(0, limitNum)

    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getUnreadNotificationCount(professionalId: string | null, adminId: string | null) {
  try {
    const promises = []
    
    if (professionalId) {
      const ref = collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'notifications')
      promises.push(getCountFromServer(query(ref, where('is_read', '==', false))).then(s => s.data().count))
    }
    
    if (adminId) {
      const ref = collection(db, 'companies', getCompanyId(), 'admins', adminId, 'notifications')
      promises.push(getCountFromServer(query(ref, where('is_read', '==', false))).then(s => s.data().count))
    }

    const counts = await Promise.all(promises)
    return { count: counts.reduce((a, b) => a + b, 0), error: null }
  } catch (error) {
    return { count: 0, error }
  }
}

export async function markNotificationAsRead(professionalId: string | null, adminId: string | null, notificationId: string, source: 'professional' | 'admin' = 'professional') {
  try {
    const targetId = source === 'admin' ? adminId : professionalId
    if (!targetId) return { error: null }
    
    const collectionName = source === 'admin' ? 'admins' : 'professionals'
    const ref = doc(db, 'companies', getCompanyId(), collectionName, targetId, 'notifications', notificationId)
    await updateDoc(ref, { is_read: true })
    
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function markAllNotificationsAsRead(professionalId: string | null, adminId: string | null) {
  try {
    const queries = []
    
    if (professionalId) {
      const ref = collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'notifications')
      queries.push(getDocs(query(ref, where('is_read', '==', false))))
    }
    
    if (adminId) {
      const ref = collection(db, 'companies', getCompanyId(), 'admins', adminId, 'notifications')
      queries.push(getDocs(query(ref, where('is_read', '==', false))))
    }

    const snapshots = await Promise.all(queries)

    // Simplification for batch update
    // Depending on size this could need a batched write, doing individual updates for safety here
    const promises = snapshots.flatMap(s => s.docs.map(d => updateDoc(d.ref, { is_read: true })))
    await Promise.all(promises)

    return { error: null }
  } catch (error) {
    return { error }
  }
}

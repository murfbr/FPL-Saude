import { db } from '@/lib/firebase'
import { Notification } from '@/types'
import { collection, query, where, getDocs, doc, setDoc, updateDoc, orderBy, limit, getCountFromServer, getDoc } from 'firebase/firestore'

const COMPANY_ID = 'fpl-saude'

export async function getNotifications(professionalId: string) {
  try {
    const ref = collection(db, 'companies', COMPANY_ID, 'professionals', professionalId, 'notifications')
    const q = query(ref)
    const snapshot = await getDocs(q)

    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification))
    data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getRecentUnreadNotifications(
  professionalId: string,
  limitNum = 3,
) {
  try {
    const ref = collection(db, 'companies', COMPANY_ID, 'professionals', professionalId, 'notifications')
    const q = query(ref, where('is_read', '==', false))
    const snapshot = await getDocs(q)

    let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification))

    // Sort in memory to avoid requiring a composite index in Firestore
    data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    data = data.slice(0, limitNum)

    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getUnreadNotificationCount(professionalId: string) {
  try {
    const ref = collection(db, 'companies', COMPANY_ID, 'professionals', professionalId, 'notifications')
    const q = query(ref, where('is_read', '==', false))
    const snapshot = await getCountFromServer(q)

    return { count: snapshot.data().count, error: null }
  } catch (error) {
    return { count: 0, error }
  }
}

export async function markNotificationAsRead(professionalId: string, notificationId: string) {
  try {
    const ref = doc(db, 'companies', COMPANY_ID, 'professionals', professionalId, 'notifications', notificationId)
    await updateDoc(ref, { is_read: true })
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function markAllNotificationsAsRead(professionalId: string) {
  try {
    const ref = collection(db, 'companies', COMPANY_ID, 'professionals', professionalId, 'notifications')
    const q = query(ref, where('is_read', '==', false))
    const snapshot = await getDocs(q)

    // Simplification for batch update
    // Depending on size this could need a batched write, doing individual updates for safety here
    const promises = snapshot.docs.map(d => updateDoc(d.ref, { is_read: true }))
    await Promise.all(promises)

    return { error: null }
  } catch (error) {
    return { error }
  }
}

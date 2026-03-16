import { db } from '@/shared/lib/firebase'
import { TimeRecord } from '@/shared/types'
import { collection, query, where, getDocs, doc, setDoc, updateDoc, orderBy, limit, getDoc } from 'firebase/firestore'
import { format } from 'date-fns'

import { getCompanyId } from '@/shared/lib/tenantStore'

export async function getTodayRecord(
  professionalId: string,
): Promise<{ data: TimeRecord | null; error: any }> {
  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    const ref = collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'time_tracking')
    const q = query(ref, where('date', '==', today))
    const snapshot = await getDocs(q)

    if (snapshot.empty) return { data: null, error: null }
    // Sort manually or use descending query, assuming at most one per day usually
    const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TimeRecord))
    return { data: records[0], error: null }

  } catch (error) {
    return { data: null, error }
  }
}

export async function clockIn(
  professionalId: string,
): Promise<{ data: TimeRecord | null; error: any }> {
  try {
    const now = new Date()
    const today = format(now, 'yyyy-MM-dd')
    const time = format(now, 'HH:mm:ss')

    const ref = doc(collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'time_tracking'))

    const record: TimeRecord = {
      id: ref.id,
      professional_id: professionalId,
      date: today,
      clock_in: time,
      clock_out: null,
      created_at: now.toISOString()
    }

    await setDoc(ref, record)
    return { data: record, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function clockOut(
  professionalId: string,
  recordId: string,
): Promise<{ data: TimeRecord | null; error: any }> {
  try {
    const now = new Date()
    const time = format(now, 'HH:mm:ss')

    const ref = doc(db, 'companies', getCompanyId(), 'professionals', professionalId, 'time_tracking', recordId)
    await updateDoc(ref, { clock_out: time })

    const snap = await getDoc(ref)
    return { data: { id: snap.id, ...snap.data() } as TimeRecord, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function upsertTimeRecord(
  professionalId: string,
  date: string,
  clockInTime: string,
  clockOutTime: string | null,
): Promise<{ data: TimeRecord | null; error: any }> {
  try {
    const refCol = collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'time_tracking')
    const q = query(refCol, where('date', '==', date))
    const snapshot = await getDocs(q)

    let docRef
    if (!snapshot.empty) {
      docRef = snapshot.docs[0].ref
      await updateDoc(docRef, { clock_in: clockInTime, clock_out: clockOutTime })
    } else {
      docRef = doc(refCol)
      await setDoc(docRef, {
        id: docRef.id,
        professional_id: professionalId,
        date: date,
        clock_in: clockInTime,
        clock_out: clockOutTime,
        created_at: new Date().toISOString()
      })
    }

    const snap = await getDoc(docRef)
    return { data: { id: snap.id, ...snap.data() } as TimeRecord, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getMonthlyTimeRecords(
  professionalId: string,
  year: number,
  month: number,
): Promise<{ data: TimeRecord[] | null; error: any }> {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    let endYear = year
    let endMonth = month + 1
    if (endMonth > 12) {
      endMonth = 1
      endYear = year + 1
    }
    const endDateStr = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

    const ref = collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'time_tracking')
    const q = query(ref, where('date', '>=', startDate), where('date', '<', endDateStr))
    const snapshot = await getDocs(q)

    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TimeRecord))
    data.sort((a, b) => a.date.localeCompare(b.date) || a.clock_in.localeCompare(b.clock_in))

    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getTimeTrackingHistory(
  professionalId: string,
  limitNum = 20,
): Promise<{ data: TimeRecord[] | null; error: any }> {
  try {
    const ref = collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'time_tracking')
    const q = query(ref, orderBy('date', 'desc'), limit(limitNum))
    const snapshot = await getDocs(q)

    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TimeRecord))
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

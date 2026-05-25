import { db } from '@/shared/lib/firebase'
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore'
import { RecurringAvailability, AvailabilityOverride, BlockedDate } from '@/shared/types'
import { format } from 'date-fns'

import { getCompanyId } from '@/shared/lib/tenantStore'

export async function setRecurringAvailability(
  professionalId: string,
  availabilities: Omit<RecurringAvailability, 'id' | 'professional_id' | 'created_at'>[],
): Promise<{ error: any }> {
  try {
    const batch = writeBatch(db)
    const ref = collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'recurring_availability')

    // Fetch and delete existing
    const existing = await getDocs(ref)
    existing.forEach(doc => {
      batch.delete(doc.ref)
    })

    // Insert new
    availabilities.forEach(a => {
      const newRef = doc(ref)
      batch.set(newRef, {
        ...a,
        professional_id: professionalId,
        service_ids: a.service_ids?.length ? a.service_ids : null,
      })
    })

    await batch.commit()
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function addAvailabilityOverride(
  override: Omit<AvailabilityOverride, 'id' | 'created_at'>,
): Promise<{ data: AvailabilityOverride | null; error: any }> {
  try {
    const ref = doc(collection(db, 'companies', getCompanyId(), 'professionals', override.professional_id, 'availability_overrides'))
    const docData = { ...override, id: ref.id }
    await setDoc(ref, docData)
    return { data: docData as AvailabilityOverride, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function deleteAvailabilityOverride(
  overrideId: string,
): Promise<{ error: any }> {
  try {
    throw new Error('Please pass professional_id to delete override in Firebase or use the updated function signature.')
  } catch (error) {
    return { error }
  }
}

export async function removeDayOverrides(
  professionalId: string,
  date: Date,
): Promise<{ error: any }> {
  try {
    const overrideDate = format(date, 'yyyy-MM-dd')
    const ref = collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'availability_overrides')
    const q = query(ref, where('override_date', '==', overrideDate))
    const snapshot = await getDocs(q)

    const batch = writeBatch(db)
    snapshot.forEach(d => batch.delete(d.ref))
    await batch.commit()

    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function blockDay(
  professionalId: string,
  date: Date,
): Promise<{ error: any }> {
  try {
    await removeDayOverrides(professionalId, date)
    const overrideDate = format(date, 'yyyy-MM-dd')

    const ref = doc(collection(db, 'companies', getCompanyId(), 'professionals', professionalId, 'availability_overrides'))
    await setDoc(ref, {
      id: ref.id,
      professional_id: professionalId,
      override_date: overrideDate,
      start_time: '00:00:00',
      end_time: '23:59:59',
      is_available: false,
    })

    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function addGlobalBlockedDate(
  date: string,
  type: 'single' | 'annual',
  reason: string | null = null
): Promise<{ data: BlockedDate | null; error: any }> {
  try {
    const ref = doc(collection(db, 'companies', getCompanyId(), 'blocked_dates'))
    const docData: BlockedDate = {
      id: ref.id,
      date,
      type,
      reason,
      created_at: new Date().toISOString()
    }
    await setDoc(ref, docData)
    return { data: docData, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function deleteGlobalBlockedDate(id: string): Promise<{ error: any }> {
  try {
    const ref = doc(db, 'companies', getCompanyId(), 'blocked_dates', id)
    await deleteDoc(ref)
    return { error: null }
  } catch (error) {
    return { error }
  }
}

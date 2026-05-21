import { db } from '@/shared/lib/firebase'
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  collectionGroup,
  orderBy,
  where,
  getCountFromServer,
  limit as fbLimit,
  writeBatch,
} from 'firebase/firestore'
import { Client, ClientPackageWithDetails, ClientSubscription, Appointment, NoteEntry, ClientExam } from '@/shared/types'
import { getCompanyId } from '@/shared/lib/tenantStore'

export async function createClient(
  clientData: Omit<Client, 'id' | 'created_at' | 'user_id' | 'is_active'>,
): Promise<{ data: Client | null; error: any }> {
  try {
    const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')
    const newDocRef = doc(clientsRef)

    // Parse birth date for indexing: "YYYY-MM-DD" -> "MM-DD"
    let birth_month_day = null
    if (clientData.birth_date) {
      const parts = clientData.birth_date.split('-')
      if (parts.length >= 3) {
        birth_month_day = `${parts[1]}-${parts[2]}`
      }
    }

    const newClient = {
      id: newDocRef.id,
      ...clientData,
      is_active: true,
      birth_month_day,
    }

    await setDoc(newDocRef, newClient)
    return { data: newClient as Client, error: null }
  } catch (error) {
    return { data: null, error }
  }
}


export async function updateClient(
  clientId: string,
  updates: Partial<Client>,
): Promise<{ data: Client | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'clients', clientId)

    // Auto-update birth_month_day if birth_date is changed
    if (updates.birth_date) {
      const parts = updates.birth_date.split('-')
      if (parts.length >= 3) {
        (updates as any).birth_month_day = `${parts[1]}-${parts[2]}`
      }
    }

    await updateDoc(docRef, updates)

    // Sincronizar dados denormalizados nos agendamentos
    if (updates.name !== undefined || updates.phone !== undefined || updates.email !== undefined) {
      const appointmentsRef = collection(db, 'companies', getCompanyId(), 'appointments')
      const q = query(appointmentsRef, where('client_id', '==', clientId))
      const apptsSnap = await getDocs(q)

      if (!apptsSnap.empty) {
        const batches = []
        let currentBatch = writeBatch(db)
        let operationCount = 0

        apptsSnap.forEach(apptDoc => {
          const apptData = apptDoc.data()
          const newClientsObj = {
            ...apptData.clients,
            ...(updates.name !== undefined && { name: updates.name }),
            ...(updates.phone !== undefined && { phone: updates.phone }),
            ...(updates.email !== undefined && { email: updates.email })
          }
          currentBatch.update(apptDoc.ref, { clients: newClientsObj })
          operationCount++

          if (operationCount === 500) {
            batches.push(currentBatch.commit())
            currentBatch = writeBatch(db)
            operationCount = 0
          }
        })

        if (operationCount > 0) {
          batches.push(currentBatch.commit())
        }
        await Promise.all(batches)
      }
    }

    const snapshot = await getDoc(docRef)
    return { data: { id: snapshot.id, ...snapshot.data() } as Client, error: null }
  } catch (error) {
    return { data: null, error }
  }
}


export async function deleteClient(clientId: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'clients', clientId)
    await deleteDoc(docRef)
    return { error: null }
  } catch (error) {
    return { error }
  }
}

// Stubs for Payments, Memberships and Reports for now.
// O Supabase antigo tinha funções complexas para esses três que precisarão
// ser gradualmente construídas como subcoleções no Firestore.
// Subcoleções ativas para a UI

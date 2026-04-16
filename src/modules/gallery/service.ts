import { db, storage } from '@/shared/lib/firebase'
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
} from 'firebase/firestore'
import { ref, deleteObject, getDownloadURL } from 'firebase/storage'
import { GalleryRecord } from '@/shared/types'
import { getCompanyId } from '@/shared/lib/tenantStore'
import { uploadFile } from '@/shared/lib/storage'

/**
 * Retorna todos os registros de galeria de todos os clientes da empresa, útil para o módulo global.
 */
export async function getAllGalleryRecords(): Promise<{ data: GalleryRecord[] | null; error: any }> {
  try {
    const companyId = getCompanyId()
    if (!companyId) throw new Error('Company ID not found')

    // Since gallery is a subcollection of clients, and we want it globally for the company,
    // we can either use a collectionGroup query OR structure it at the company level.
    // Given the previous design: `companies/{companyId}/clients/{clientId}/gallery`
    // We must use collectionGroup to fetch all galleries across clients, but filter by company.
    // However, collectionGroup doesn't easily filter by parent document ID unless stored on the doc.
    // So we will use a collectionGroup query on 'gallery' and filter by company_id, 
    // BUT we must ensure `company_id` is saved on the gallery record!
    // Alternatively, we can fetch all Active Clients first, then fetch their galleries (which is very expensive).
    // Let's use collectionGroup and assume we save company_id on each record, 
    // OR we change the storage to `companies/{companyId}/gallery` and store `client_id` inside it!
    // 
    // DECISION: It is much cheaper and efficient to store at `companies/{companyId}/gallery` 
    // and have `client_id` as a field. So we will use `companies/{companyId}/gallery` 
    // as the main collection path.
    const galleryRef = collection(db, 'companies', companyId, 'gallery')
    const q = query(galleryRef, orderBy('date', 'desc'))
    const snapshot = await getDocs(q)
    
    const records: GalleryRecord[] = []
    snapshot.forEach(doc => {
      records.push({ id: doc.id, ...doc.data() } as GalleryRecord)
    })

    return { data: records, error: null }
  } catch (error) {
    console.error("Erro ao buscar registros globais da galeria:", error)
    return { data: null, error }
  }
}

export async function getClientGallery(clientId: string): Promise<{ data: GalleryRecord[] | null; error: any }> {
  try {
    const companyId = getCompanyId()
    const galleryRef = collection(db, 'companies', companyId, 'gallery')
    const q = query(galleryRef, where('client_id', '==', clientId), orderBy('date', 'desc'))
    const snapshot = await getDocs(q)
    
    const records: GalleryRecord[] = []
    snapshot.forEach(doc => {
      records.push({ id: doc.id, ...doc.data() } as GalleryRecord)
    })

    return { data: records, error: null }
  } catch (error) {
    console.error("Erro ao buscar galeria do cliente:", error)
    return { data: null, error }
  }
}

export async function uploadGalleryPhoto(
  clientId: string,
  file: File,
  prefix: 'before' | 'after'
): Promise<{ url: string | null; path: string | null; error: any }> {
  try {
    const companyId = getCompanyId()
    const timestamp = new Date().getTime()
    // Limpar o nome do arquivo de caracteres estranhos
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')
    const path = `companies/${companyId}/clients/${clientId}/gallery/${timestamp}_${prefix}_${safeName}`
    const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'fpl-saude.firebasestorage.app'

    const { data: uploadSnap, error: uploadError } = await uploadFile(bucket, path, file)
    if (uploadError) throw uploadError

    const url = await getDownloadURL(uploadSnap.ref)
    return { url, path, error: null }
  } catch (error) {
    console.error(`Erro no upload da foto ${prefix}:`, error)
    return { url: null, path: null, error }
  }
}

export async function createGalleryRecord(data: Omit<GalleryRecord, 'id' | 'created_at'>): Promise<{ data: GalleryRecord | null; error: any }> {
  try {
    const companyId = getCompanyId()
    const galleryRef = collection(db, 'companies', companyId, 'gallery')
    const newDoc = doc(galleryRef)
    
    // In order to show patient names on the global list, we fetch the client name
    let clientName = data.client_name
    if (!clientName) {
      const clientSnap = await getDoc(doc(db, 'companies', companyId, 'clients', data.client_id))
      if (clientSnap.exists()) {
        clientName = clientSnap.data().name
      }
    }

    const record: GalleryRecord = {
      ...data,
      id: newDoc.id,
      client_name: clientName,
      created_at: new Date().toISOString()
    }

    // O Firebase bloqueia o envio de propriedades "undefined"
    const cleanRecord = Object.fromEntries(Object.entries(record).filter(([_, v]) => v !== undefined)) as GalleryRecord

    await setDoc(newDoc, cleanRecord)
    return { data: cleanRecord, error: null }
  } catch (error) {
    console.error("Erro ao criar registro na galeria:", error)
    return { data: null, error }
  }
}

export async function updateGalleryRecord(id: string, updates: Partial<GalleryRecord>): Promise<{ error: any }> {
  try {
    const companyId = getCompanyId()
    const docRef = doc(db, 'companies', companyId, 'gallery', id)
    await updateDoc(docRef, updates)
    return { error: null }
  } catch (error) {
    console.error("Erro ao atualizar registro na galeria:", error)
    return { error }
  }
}

export async function deleteGalleryRecord(id: string, pathsToDelete: string[]): Promise<{ error: any }> {
  try {
    const companyId = getCompanyId()
    
    // Delete record from firestore
    const docRef = doc(db, 'companies', companyId, 'gallery', id)
    await deleteDoc(docRef)

    // Delete associated images from storage
    for (const path of pathsToDelete) {
      if (path) {
        try {
          const storageRef = ref(storage, path)
          await deleteObject(storageRef)
        } catch (e) {
          console.warn(`Could not delete object at ${path}:`, e)
        }
      }
    }

    return { error: null }
  } catch (error) {
    console.error("Erro ao deletar registro na galeria:", error)
    return { error }
  }
}

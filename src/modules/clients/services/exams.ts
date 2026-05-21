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
import { uploadFile } from '@/shared/lib/storage'
import { deleteObject, ref, getDownloadURL } from 'firebase/storage'
import { storage } from '@/shared/lib/firebase'

export async function getClientExams(clientId: string): Promise<{ data: ClientExam[] | null; error: any }> {
  try {
    const examsRef = collection(db, 'companies', getCompanyId(), 'clients', clientId, 'exams')
    const q = query(examsRef, orderBy('created_at', 'desc'))
    const snap = await getDocs(q)
    const exams: ClientExam[] = []
    snap.forEach(doc => {
      exams.push({ id: doc.id, ...doc.data() } as ClientExam)
    })
    return { data: exams, error: null }
  } catch (error) {
    return { data: null, error }
  }
}


export async function uploadClientExam(
  clientId: string,
  examData: Omit<ClientExam, 'id' | 'file_url' | 'file_path' | 'created_at'>,
  file: File
): Promise<{ data: ClientExam | null; error: any }> {
  try {
    const companyId = getCompanyId()
    const timestamp = new Date().getTime()
    const filePath = `companies/${companyId}/clients/${clientId}/exams/${timestamp}_${file.name}`
    const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'fpl-saude.firebasestorage.app'

    const { data: uploadSnap, error: uploadError } = await uploadFile(bucket, filePath, file)
    if (uploadError) throw uploadError

    const fileUrl = await getDownloadURL(uploadSnap.ref)

    const examsRef = collection(db, 'companies', companyId, 'clients', clientId, 'exams')
    const newDoc = doc(examsRef)
    const newExam: ClientExam = {
      id: newDoc.id,
      client_id: clientId,
      ...examData,
      file_url: fileUrl,
      file_path: filePath,
      created_at: new Date().toISOString()
    }

    await setDoc(newDoc, newExam)
    return { data: newExam, error: null }
  } catch (error) {
    console.error("Erro ao fazer upload do exame: ", error)
    return { data: null, error }
  }
}


export async function deleteClientExam(clientId: string, examId: string, filePath: string): Promise<{ error: any }> {
  try {
    const companyId = getCompanyId()
    const docRef = doc(db, 'companies', companyId, 'clients', clientId, 'exams', examId)
    await deleteDoc(docRef)

    const storageRef = ref(storage, filePath)
    await deleteObject(storageRef)

    return { error: null }
  } catch (error) {
    return { error }
  }
}

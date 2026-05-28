import { db } from '@/shared/lib/firebase'
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore'
import { ClinicalDocument } from '@/shared/types'
import { getCompanyId } from '@/shared/lib/tenantStore'
import { uploadFile } from '@/shared/lib/storage'
import { deleteObject, ref, getDownloadURL } from 'firebase/storage'
import { storage } from '@/shared/lib/firebase'

export async function getClinicalDocuments(clientId: string): Promise<{ data: ClinicalDocument[] | null; error: any }> {
  try {
    const docsRef = collection(db, 'companies', getCompanyId(), 'clients', clientId, 'clinical_documents')
    const q = query(docsRef, orderBy('created_at', 'desc'))
    const snap = await getDocs(q)
    const documents: ClinicalDocument[] = []
    snap.forEach(d => {
      documents.push({ id: d.id, ...d.data() } as ClinicalDocument)
    })
    return { data: documents, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function saveClinicalDocument(
  clientId: string,
  documentData: Omit<ClinicalDocument, 'id' | 'created_at' | 'client_id' | 'file_url' | 'file_path'>,
  pdfBlob: Blob
): Promise<{ data: ClinicalDocument | null; error: any }> {
  try {
    const companyId = getCompanyId()
    const timestamp = new Date().getTime()
    const filePath = `companies/${companyId}/clients/${clientId}/clinical_documents/${timestamp}_${documentData.type}.pdf`
    const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'fpl-saude.firebasestorage.app'

    const { data: uploadSnap, error: uploadError } = await uploadFile(bucket, filePath, pdfBlob as File)
    if (uploadError) throw uploadError

    const fileUrl = await getDownloadURL(uploadSnap.ref)

    const docsRef = collection(db, 'companies', companyId, 'clients', clientId, 'clinical_documents')
    const newDoc = doc(docsRef)
    
    const newClinicalDocument: ClinicalDocument = {
      id: newDoc.id,
      client_id: clientId,
      ...documentData,
      file_url: fileUrl,
      file_path: filePath,
      created_at: new Date().toISOString()
    }

    await setDoc(newDoc, newClinicalDocument)
    return { data: newClinicalDocument, error: null }
  } catch (error) {
    console.error("Erro ao salvar documento clínico: ", error)
    return { data: null, error }
  }
}

export async function updateClinicalDocument(
  clientId: string,
  documentId: string,
  documentData: Partial<Omit<ClinicalDocument, 'id' | 'created_at' | 'client_id'>>,
  pdfBlob: Blob
): Promise<{ data: ClinicalDocument | null; error: any }> {
  try {
    const companyId = getCompanyId()
    
    // Upload novo PDF mantendo mesmo filePath se possível, ou gerando novo se não houver
    const snapToGetPath = await getDocs(query(collection(db, 'companies', companyId, 'clients', clientId, 'clinical_documents')))
    const oldDoc = snapToGetPath.docs.find(d => d.id === documentId)?.data() as ClinicalDocument
    
    let filePath = oldDoc?.file_path
    if (!filePath) {
      const timestamp = new Date().getTime()
      filePath = `companies/${companyId}/clients/${clientId}/clinical_documents/${timestamp}_${documentData.type || 'document'}.pdf`
    }
    
    const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'fpl-saude.firebasestorage.app'
    const { data: uploadSnap, error: uploadError } = await uploadFile(bucket, filePath, pdfBlob as File)
    if (uploadError) throw uploadError

    const fileUrl = await getDownloadURL(uploadSnap.ref)

    const docRef = doc(db, 'companies', companyId, 'clients', clientId, 'clinical_documents', documentId)
    
    await setDoc(docRef, { ...documentData, file_url: fileUrl, file_path: filePath }, { merge: true })
    
    // Fetch the updated document to return it
    const snap = await getDocs(query(collection(db, 'companies', companyId, 'clients', clientId, 'clinical_documents')))
    const updatedDoc = snap.docs.find(d => d.id === documentId)
    
    return { data: updatedDoc ? { id: updatedDoc.id, ...updatedDoc.data() } as ClinicalDocument : null, error: null }
  } catch (error) {
    console.error("Erro ao atualizar documento clínico: ", error)
    return { data: null, error }
  }
}

export async function deleteClinicalDocument(clientId: string, documentId: string): Promise<{ error: any }> {
  try {
    const companyId = getCompanyId()
    const docRef = doc(db, 'companies', companyId, 'clients', clientId, 'clinical_documents', documentId)
    
    // Buscar caminho do arquivo primeiro
    const snap = await getDocs(query(collection(db, 'companies', companyId, 'clients', clientId, 'clinical_documents')))
    const docData = snap.docs.find(d => d.id === documentId)?.data() as ClinicalDocument
    
    if (docData?.file_path) {
      const storageRef = ref(storage, docData.file_path)
      try {
        await deleteObject(storageRef)
      } catch (err) {
        console.warn("Erro ao deletar arquivo do storage, possivelmente não existe.", err)
      }
    }

    await deleteDoc(docRef)
    return { error: null }
  } catch (error) {
    return { error }
  }
}

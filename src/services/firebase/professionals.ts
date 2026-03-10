import { db } from '@/lib/firebase'
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore'
import { Professional, Service } from '@/types'

const COMPANY_ID = 'fpl-saude'

export async function getProfessionalsByService(
  serviceId: string,
): Promise<{ data: Professional[] | null; error: any }> {
  try {
    const profsRef = collection(db, 'companies', COMPANY_ID, 'professionals')
    // Magia do NoSQL: Onde no SQL faziamos um JOIN com 'professional_services',
    // Aqui usamos um simples 'array-contains' na lista de 'service_ids' do médico.
    const q = query(profsRef, where('service_ids', 'array-contains', serviceId))
    const snapshot = await getDocs(q)
    
    const professionals: Professional[] = []
    snapshot.forEach(doc => {
      professionals.push({ id: doc.id, ...doc.data() } as Professional)
    })
    
    return { data: professionals, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getAllProfessionals(options?: {
  activeOnly?: boolean
}): Promise<{ data: Professional[] | null; error: any }> {
  try {
    const profsRef = collection(db, 'companies', COMPANY_ID, 'professionals')
    let q = query(profsRef, orderBy('name', 'asc'))
    
    if (options?.activeOnly) {
      q = query(profsRef, where('is_active', '==', true), orderBy('name', 'asc'))
    }
    
    const snapshot = await getDocs(q)
    const professionals: Professional[] = []
    
    snapshot.forEach(doc => {
      professionals.push({ id: doc.id, ...doc.data() } as Professional)
    })
    
    return { data: professionals, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getProfessionalById(
  id: string,
): Promise<{ data: Professional | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'professionals', id)
    const snapshot = await getDoc(docRef)
    
    if (!snapshot.exists()) return { data: null, error: new Error('Profissional não encontrado') }
    return { data: { id: snapshot.id, ...snapshot.data() } as Professional, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function updateProfessional(
  id: string,
  updates: Partial<Omit<Professional, 'id' | 'created_at' | 'user_id'>>,
): Promise<{ data: Professional | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'professionals', id)
    await updateDoc(docRef, updates)
    
    const snapshot = await getDoc(docRef)
    return { data: { id: snapshot.id, ...snapshot.data() } as Professional, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function deleteProfessional(id: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'professionals', id)
    await deleteDoc(docRef)
    return { error: null }
  } catch (error) {
    return { error }
  }
}

// Funções de manipulação do Array de Serviços
export async function getServicesByProfessional(
  professionalId: string,
): Promise<{ data: Service[] | null; error: any }> {
  try {
    // Busca o profissional e lê seus IDs
    const { data: prof } = await getProfessionalById(professionalId)
    if (!prof || !prof.service_ids || prof.service_ids.length === 0) {
      return { data: [], error: null }
    }
    
    // Busca os dados de cada serviço baseado nesse array num batch
    const servicesRef = collection(db, 'companies', COMPANY_ID, 'services')
    const q = query(servicesRef, where('__name__', 'in', prof.service_ids))
    const snapshot = await getDocs(q)
    
    const services: Service[] = []
    snapshot.forEach(doc => {
      services.push({ id: doc.id, ...doc.data() } as Service)
    })
    
    return { data: services, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function addServiceToProfessional(
  professionalId: string,
  serviceId: string,
): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'professionals', professionalId)
    const snapshot = await getDoc(docRef)
    
    const currentServices = snapshot.data()?.service_ids || []
    if (!currentServices.includes(serviceId)) {
      currentServices.push(serviceId)
      await updateDoc(docRef, { service_ids: currentServices })
    }
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function removeServiceFromProfessional(
  professionalId: string,
  serviceId: string,
): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'professionals', professionalId)
    const snapshot = await getDoc(docRef)
    
    let currentServices = snapshot.data()?.service_ids || []
    currentServices = currentServices.filter((id: string) => id !== serviceId)
    await updateDoc(docRef, { service_ids: currentServices })
    
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function createProfessionalUser(
  data: any,
): Promise<{ data: any; error: any }> {
  // Nota: Firebase functions seria o análogo de supabase.functions.invoke.
  // Por ora deixaremos não-implementado até ajustarmos o fluxo de Auth
  return { data: null, error: new Error('Função de Servidor pendente') }
}

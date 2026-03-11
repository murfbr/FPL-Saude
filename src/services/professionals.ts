import { db } from '@/lib/firebase'
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore'
import { Professional, Service } from '@/types'

const COMPANY_ID = 'fpl-saude'

export async function getProfessionalsByService(
  serviceId: string,
): Promise<{ data: Professional[] | null; error: any }> {
  try {
    const profsRef = collection(db, 'companies', COMPANY_ID, 'professionals')
    // A migração de SQL para NoSQL frequentemente converte Arrays puros em 
    // Dicionários indexados, ex: {"0": "uuid", "1": "uuid2"} ou strings.
    const q = query(profsRef)
    const snapshot = await getDocs(q)

    const professionals: Professional[] = []
    snapshot.forEach(doc => {
      const data = doc.data()
      // Filtra em memória aceitando formatações distorcidas de booleanos vindos do DB
      const isActive = data.is_active === true || data.is_active === 'true' || data.is_active === 1
      if (!isActive || !data.service_ids) return

      let hasService = false
      if (Array.isArray(data.service_ids)) {
        hasService = data.service_ids.includes(serviceId)
      } else if (typeof data.service_ids === 'string') {
        hasService = data.service_ids.includes(serviceId)
      } else if (typeof data.service_ids === 'object') {
        // Se for um mapa explícito {"id-do-servico": true}
        if (data.service_ids[serviceId]) hasService = true
        // Se for um mapa serializado de array (index-based) {"0": "id-do-servico"}
        else if (Object.values(data.service_ids).includes(serviceId)) hasService = true
      }

      if (hasService) {
        professionals.push({ id: doc.id, ...data } as Professional)
      }
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

    const snapshot = await getDocs(q)
    const professionals: Professional[] = []

    snapshot.forEach(doc => {
      const data = doc.data()
      if (options?.activeOnly) {
        const isActive = data.is_active === true || data.is_active === 'true' || data.is_active === 1
        if (!isActive) return
      }
      professionals.push({ id: doc.id, ...data } as Professional)
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

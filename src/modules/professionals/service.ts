import { db } from '@/shared/lib/firebase'
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, where, getCountFromServer } from 'firebase/firestore'
import { Professional, Service } from '@/shared/types'

import { getCompanyId } from '@/shared/lib/tenantStore'
import { secondaryAuth, secondaryDb } from '@/shared/lib/firebase'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'

export async function getProfessionalsByService(
  serviceId: string,
): Promise<{ data: Professional[] | null; error: any }> {
  try {
    const profsRef = collection(db, 'companies', getCompanyId(), 'professionals')
    
    // Optimized Query: We rely on Firestore 'array-contains' for explosive speed instead of pulling everything.
    const q = query(
      profsRef, 
      where('service_ids', 'array-contains', serviceId)
    )
    
    const snapshot = await getDocs(q)
    const professionals: Professional[] = []
    
    snapshot.forEach(doc => {
      const data = doc.data()
      // Filtro resiliente: considera ativo se não for explicitamente falso
      const isActive = data.is_active !== false && data.is_active !== 'false' && data.is_active !== 0
      if (isActive) {
        professionals.push({ id: doc.id, ...data } as Professional)
      }
    })

    console.log(`[DEBUG] getProfessionalsByService(${serviceId}): Found ${professionals.length} professionals`, professionals.map(p => p.name))
    return { data: professionals, error: null }
  } catch (error: any) {
    console.error("🔥 [AÇÃO NECESSÁRIA - ÍNDICE FIRESTORE]: O Firebase provavelmente bloqueou a query exigindo um índice composto. Verifique o link no console abaixo:", error.message)
    // Fallback lento caso o índice não exista ainda (Evita que o sistema quebre totalmente enquanto o cliente cria o índice)
    try {
      const fallbackSnapshot = await getDocs(collection(db, 'companies', getCompanyId(), 'professionals'))
      const fallbackPros: Professional[] = []
      fallbackSnapshot.forEach(doc => {
        const data = doc.data()
        if (data.is_active && Array.isArray(data.service_ids) && data.service_ids.includes(serviceId)) {
          fallbackPros.push({ id: doc.id, ...data } as Professional)
        }
      })
      console.log(`[DEBUG] getProfessionalsByService(${serviceId}) (fallback): Found ${fallbackPros.length} professionals`, fallbackPros.map(p => p.name))
      return { data: fallbackPros, error: null }
    } catch (fallbackError) {
      return { data: null, error: fallbackError }
    }
  }
}

export async function getAllProfessionals(options?: {
  activeOnly?: boolean
}): Promise<{ data: Professional[] | null; error: any }> {
  try {
    const profsRef = collection(db, 'companies', getCompanyId(), 'professionals')
    let q = query(profsRef, orderBy('name', 'asc'))

    const snapshot = await getDocs(q)
    const professionals: Professional[] = []

    snapshot.forEach(doc => {
      const data = doc.data()
      if (options?.activeOnly) {
        // Filtro resiliente: considera ativo se não for explicitamente falso (null/undefined = ativo por padrão)
        const isActive = data.is_active !== false && data.is_active !== 'false' && data.is_active !== 0
        if (!isActive) return
      }
      professionals.push({ id: doc.id, ...data } as Professional)
    })

    return { data: professionals, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getProfessionalsCount(): Promise<{ count: number; error: any }> {
  try {
    const profsRef = collection(db, 'companies', getCompanyId(), 'professionals')
    const q = query(profsRef)
    const snapshot = await getCountFromServer(q)
    return { count: snapshot.data().count, error: null }
  } catch (error) {
    console.error("Erro ao puxar contador de profissionais: ", error)
    return { count: 0, error }
  }
}

export async function getProfessionalById(
  id: string,
): Promise<{ data: Professional | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'professionals', id)
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
    const docRef = doc(db, 'companies', getCompanyId(), 'professionals', id)
    await updateDoc(docRef, updates)

    const snapshot = await getDoc(docRef)
    return { data: { id: snapshot.id, ...snapshot.data() } as Professional, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function deleteProfessional(id: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'professionals', id)
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
    const servicesRef = collection(db, 'companies', getCompanyId(), 'services')
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
    const docRef = doc(db, 'companies', getCompanyId(), 'professionals', professionalId)
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
    const docRef = doc(db, 'companies', getCompanyId(), 'professionals', professionalId)
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
  try {
    const companyId = getCompanyId()
    
    // 1. Criar usuário no Firebase Auth usando o app secundário (não desloga o admin atual)
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password)
    const user = userCredential.user

    await updateProfile(user, { displayName: data.name })

    // 2. Criar registro na coleção raiz `users` para roteamento e permissionamento
    const userDocRef = doc(secondaryDb, 'users', user.uid)
    await setDoc(userDocRef, {
      name: data.name,
      email: data.email,
      role: 'professional',
      companyId: companyId,
      created_at: new Date().toISOString(),
    })

    // 3. Criar registro na subcoleção `professionals` da empresa logada
    // Usamos secondaryDb pois, após o passo 2, este ambiente já passou a pertencer à companyId perante o Firestore Rules
    const professionalDocRef = doc(collection(secondaryDb, 'companies', companyId, 'professionals'))
    const profData = {
      id: professionalDocRef.id,
      user_id: user.uid,
      name: data.name,
      email: data.email,
      specialty: data.specialty || '',
      bio: data.bio || '',
      avatar_url: data.avatar_url || '',
      is_active: true,
      service_ids: [],
      created_at: new Date().toISOString(),
    }
    await setDoc(professionalDocRef, profData)

    // O secondaryAuth não precisa de signOut explícito, pois a instância auth principal do app 
    // continua conectada com o Admin. Apenas fechamos as operações.
    
    return { data: profData, error: null }
  } catch (error) {
    console.error("Erro ao criar usuário profissional:", error)
    return { data: null, error }
  }
}


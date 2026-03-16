import { db } from '@/shared/lib/firebase'
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore'
import { Service } from '@/shared/types'

import { getCompanyId } from '@/shared/lib/tenantStore'

// Cache em memória para reduzir reads de serviços (TTL de 5 min)
const serviceCache = new Map<string, { data: Service, expiry: number }>()
const CACHE_TTL = 5 * 60 * 1000

export async function getServices(): Promise<{ data: Service[] | null; error: any }> {
  try {
    const servicesRef = collection(db, 'companies', getCompanyId(), 'services')
    const q = query(servicesRef, orderBy('name', 'asc'))
    const snapshot = await getDocs(q)

    // Buscar pacotes globais para hidratar (simulando JOIN)
    const pkgsRef = collection(db, 'companies', getCompanyId(), 'packages')
    const pkgsSnap = await getDocs(pkgsRef)
    const allPkgs = pkgsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))

    const plansRef = collection(db, 'companies', getCompanyId(), 'subscription_plans')
    const plansSnap = await getDocs(plansRef)
    const allPlans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))

    const services: Service[] = []
    snapshot.forEach(doc => {
      const data = doc.data()
      services.push({
        id: doc.id,
        ...data,
        packages: allPkgs.filter(p => p.service_id === doc.id),
        subscription_plans: allPlans.filter(p => p.service_id === doc.id)
      } as Service)
    })

    return { data: services, error: null }
  } catch (error) {
    console.error("🔥 [AÇÃO NECESSÁRIA - CLIQUE NO LINK ABAIXO PARA CRIAR ÍNDICE DE SERVIÇOS]: ", error)
    return { data: null, error }
  }
}

export async function createService(
  service: Omit<Service, 'id' | 'packages' | 'subscription_plans'>
): Promise<{ data: Service | null; error: any }> {
  try {
    const servicesRef = collection(db, 'companies', getCompanyId(), 'services')
    const newDocRef = doc(servicesRef) // Add Id dinamicamente
    const newService = { id: newDocRef.id, ...service }

    await setDoc(newDocRef, newService)
    return { data: newService as Service, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function updateService(
  serviceId: string,
  serviceUpdates: Partial<Omit<Service, 'id' | 'packages' | 'subscription_plans'>>
): Promise<{ data: Service | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'services', serviceId)
    await updateDoc(docRef, serviceUpdates)

    const snapshot = await getDoc(docRef)
    return { data: { id: snapshot.id, ...snapshot.data() } as Service, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function deleteService(serviceId: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'services', serviceId)
    await deleteDoc(docRef)
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function getAllServices(): Promise<{ data: Service[] | null; error: any }> {
  return getServices()
}

export async function getServiceById(
  serviceId: string,
): Promise<{ data: Service | null; error: any }> {
  try {
    const now = Date.now()
    const cached = serviceCache.get(serviceId)
    if (cached && now < cached.expiry) {
      return { data: cached.data, error: null }
    }

    const docRef = doc(db, 'companies', getCompanyId(), 'services', serviceId)
    const snapshot = await getDoc(docRef)

    if (!snapshot.exists()) return { data: null, error: new Error('Serviço não encontrado') }
    
    const serviceData = { id: snapshot.id, ...snapshot.data() } as Service
    serviceCache.set(serviceId, { data: serviceData, expiry: now + CACHE_TTL })
    
    return { data: serviceData, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

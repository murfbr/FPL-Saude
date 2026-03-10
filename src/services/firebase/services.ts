import { db } from '@/lib/firebase'
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore'
import { Service } from '@/types'

// ID mockado por enquanto. O ideal seria o contexto de Tenant injetar isso
const COMPANY_ID = 'fpl-saude' 

export async function getServices(): Promise<{ data: Service[] | null; error: any }> {
  try {
    const servicesRef = collection(db, 'companies', COMPANY_ID, 'services')
    const q = query(servicesRef, orderBy('name', 'asc'))
    const snapshot = await getDocs(q)
    
    // Buscar pacotes globais para hidratar (simulando JOIN)
    const pkgsRef = collection(db, 'companies', COMPANY_ID, 'packages')
    const pkgsSnap = await getDocs(pkgsRef)
    const allPkgs = pkgsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))

    const plansRef = collection(db, 'companies', COMPANY_ID, 'subscription_plans')
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
    const servicesRef = collection(db, 'companies', COMPANY_ID, 'services')
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
    const docRef = doc(db, 'companies', COMPANY_ID, 'services', serviceId)
    await updateDoc(docRef, serviceUpdates)
    
    const snapshot = await getDoc(docRef)
    return { data: { id: snapshot.id, ...snapshot.data() } as Service, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function deleteService(serviceId: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'services', serviceId)
    await deleteDoc(docRef)
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function getAllServices(): Promise<{ data: Service[] | null; error: any }> {
  return getServices()
}

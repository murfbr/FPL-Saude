import { db } from '@/lib/firebase'
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, query, orderBy, where } from 'firebase/firestore'
import { SubscriptionPlan } from '@/types'

const COMPANY_ID = 'fpl-saude'

export async function getSubscriptionPlans(
  serviceId?: string,
  includeInactive = false,
): Promise<{ data: SubscriptionPlan[] | null; error: any }> {
  try {
    const plansRef = collection(db, 'companies', COMPANY_ID, 'subscription_plans')
    // Construção condicional de Query
    let constraints: any[] = []
    
    if (serviceId) {
      constraints.push(where('service_id', '==', serviceId))
    }
    if (!includeInactive) {
      constraints.push(where('is_active', '==', true))
    }

    const q = query(plansRef, ...constraints, orderBy('name', 'asc'))
    const snapshot = await getDocs(q)
    
    const plans: SubscriptionPlan[] = []
    for (const d of snapshot.docs) {
      const p = { id: d.id, ...d.data() } as any
      if (p.service_id) {
        const sSnap = await getDoc(doc(db, 'companies', COMPANY_ID, 'services', p.service_id))
        if(sSnap.exists()) p.services = { name: sSnap.data().name, price: sSnap.data().price }
      }
      plans.push(p)
    }
    
    return { data: plans, error: null }
  } catch (error) {
    console.error("🔥 [AÇÃO NECESSÁRIA - CLIQUE NO LINK ABAIXO PARA CRIAR ÍNDICE DE ASSINATURAS]: ", error)
    return { data: null, error }
  }
}

export async function createSubscriptionPlan(
  plan: Omit<SubscriptionPlan, 'id' | 'created_at' | 'is_active'>,
): Promise<{ data: SubscriptionPlan | null; error: any }> {
  try {
    const plansRef = collection(db, 'companies', COMPANY_ID, 'subscription_plans')
    const newDocRef = doc(plansRef)
    const newPlan = { id: newDocRef.id, ...plan, is_active: true, created_at: new Date().toISOString() }
    
    await setDoc(newDocRef, newPlan)
    return { data: newPlan as SubscriptionPlan, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function updateSubscriptionPlan(
  id: string,
  plan: Partial<Omit<SubscriptionPlan, 'id' | 'created_at'>>,
): Promise<{ data: SubscriptionPlan | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'subscription_plans', id)
    await updateDoc(docRef, plan)
    
    const snapshot = await getDoc(docRef)
    return { data: { id: snapshot.id, ...snapshot.data() } as SubscriptionPlan, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function deleteSubscriptionPlan(
  id: string,
): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'subscription_plans', id)
    await updateDoc(docRef, { is_active: false })
    return { error: null }
  } catch (error) {
    return { error }
  }
}

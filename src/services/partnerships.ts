import { db } from '@/lib/firebase'
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore'
import { Partnership, PartnershipDiscount } from '@/types'

const COMPANY_ID = 'fpl-saude'

export async function getAllPartnerships(): Promise<{ data: Partnership[] | null; error: any }> {
  try {
    const pRef = collection(db, 'companies', COMPANY_ID, 'partnerships')
    const q = query(pRef, orderBy('name', 'asc'))
    const snap = await getDocs(q)
    
    const results: Partnership[] = []
    snap.forEach(d => results.push({ id: d.id, ...d.data() } as Partnership))
    
    return { data: results, error: null }
  } catch (error) { return { data: null, error } }
}

export async function createPartnership(
  partnership: Omit<Partnership, 'id' | 'created_at'>,
): Promise<{ data: Partnership | null; error: any }> {
  try {
    const pRef = collection(db, 'companies', COMPANY_ID, 'partnerships')
    const newDoc = doc(pRef)
    const p = { id: newDoc.id, ...partnership, created_at: new Date().toISOString() }
    await setDoc(newDoc, p)
    return { data: p as Partnership, error: null }
  } catch (error) { return { data: null, error } }
}

export async function updatePartnership(
  id: string,
  updates: Partial<Omit<Partnership, 'id' | 'created_at'>>,
): Promise<{ data: Partnership | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'partnerships', id)
    await updateDoc(docRef, updates)
    return { data: null, error: null } // simplified UI return
  } catch (error) { return { data: null, error } }
}

export async function deletePartnership(id: string): Promise<{ error: any }> {
  try {
    await deleteDoc(doc(db, 'companies', COMPANY_ID, 'partnerships', id))
    return { error: null }
  } catch (error) { return { error } }
}

// Em vez de ir na Tabela XYZ, lemos do array embutido
export async function getDiscountsForPartnership(
  partnershipId: string,
): Promise<{ data: PartnershipDiscount[] | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'partnerships', partnershipId)
    const snap = await getDoc(docRef)
    if (!snap.exists()) return { data: [], error: null }
    
    // A estrutura do migration setou um array de discounts [{service_id, percentage}]
    const pData = snap.data()
    const discounts = pData.discounts || []
    
    // Hidratação opcional dos nomes dos serviços
    const hydrated = await Promise.all(discounts.map(async (d: any) => {
      const sRef = doc(db, 'companies', COMPANY_ID, 'services', d.service_id)
      const sSnap = await getDoc(sRef)
      return { 
        service_id: d.service_id, 
        discount_percentage: d.percentage,
        partnership_id: partnershipId,
        services: { name: sSnap.data()?.name }
      }
    }))

    return { data: hydrated as any[], error: null }
  } catch (error) { return { data: null, error } }
}

// Salva embutido (NoSQL Way)
export async function setPartnershipDiscounts(
  partnershipId: string,
  discounts: Omit<PartnershipDiscount, 'id' | 'created_at' | 'partnership_id'>[],
): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'partnerships', partnershipId)
    const formatted = discounts.map(d => ({
      service_id: d.service_id,
      percentage: d.discount_percentage
    }))
    await updateDoc(docRef, { discounts: formatted })
    return { error: null }
  } catch (error) { return { error } }
}

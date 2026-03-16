import { db } from '@/shared/lib/firebase'
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, query, orderBy, where } from 'firebase/firestore'
import { Package } from '@/shared/types'

import { getCompanyId } from '@/shared/lib/tenantStore'

export async function getPackages(includeInactive = false): Promise<{ data: Package[] | null; error: any }> {
  try {
    const packagesRef = collection(db, 'companies', getCompanyId(), 'packages')
    let q = query(packagesRef, orderBy('name', 'asc'))

    if (!includeInactive) {
      q = query(packagesRef, where('is_active', '==', true), orderBy('name', 'asc'))
    }

    const snapshot = await getDocs(q)
    const packages: Package[] = []
    
    for (const d of snapshot.docs) {
      const p = { id: d.id, ...d.data() } as any
      if (p.service_id) {
        const sSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'services', p.service_id))
        if(sSnap.exists()) p.services = { name: sSnap.data().name, price: sSnap.data().price }
      }
      packages.push(p)
    }
    
    return { data: packages, error: null }
  } catch (error) {
    console.error("🔥 [AÇÃO NECESSÁRIA - CLIQUE NO LINK ABAIXO PARA CRIAR ÍNDICE DE PACOTES]: ", error)
    return { data: null, error }
  }
}

export async function createPackage(
  pkg: Omit<Package, 'id' | 'services' | 'is_active'>,
): Promise<{ data: Package | null; error: any }> {
  try {
    const packagesRef = collection(db, 'companies', getCompanyId(), 'packages')
    const newDocRef = doc(packagesRef)
    const newPackage = { id: newDocRef.id, ...pkg, is_active: true }
    
    await setDoc(newDocRef, newPackage)
    return { data: newPackage as Package, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function updatePackage(
  id: string,
  pkg: Partial<Omit<Package, 'id' | 'services'>>,
): Promise<{ data: Package | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'packages', id)
    await updateDoc(docRef, pkg)
    
    const snapshot = await getDoc(docRef)
    return { data: { id: snapshot.id, ...snapshot.data() } as Package, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function deletePackage(id: string): Promise<{ error: any }> {
  // Soft delete match
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'packages', id)
    await updateDoc(docRef, { is_active: false })
    return { error: null }
  } catch (error) {
    return { error }
  }
}

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

export async function getClientPackages(clientId: string): Promise<{ data: any[] | null; error: any }> {
  try {
    const pkgsRef = collection(db, 'companies', getCompanyId(), 'clients', clientId, 'packages')
    const snap = await getDocs(pkgsRef)

    const results = []
    for (const d of snap.docs) {
      const data = d.data()
      const cp = { id: d.id, ...data } as any
      if (data.package_id) {
        const pSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'packages', data.package_id))
        if (pSnap.exists()) {
          const pkgData = pSnap.data()
          let sData = null
          if (pkgData.service_id) {
            const sSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'services', pkgData.service_id))
            if (sSnap.exists()) sData = { id: sSnap.id, ...sSnap.data() }
          }
          cp.packages = { ...pkgData, services: sData }
        }
      }
      results.push(cp)
    }
    return { data: results, error: null }
  } catch (error) { return { data: null, error } }
}


export async function getAllActiveClientPackages(options?: { limit?: number }): Promise<{ data: any[] | null; error: any }> {
  try {
    // 1. Obter todos os clientes da empresa
    const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')
    const clientsSnap = await getDocs(query(clientsRef, where('is_active', '==', true)))

    let results: any[] = []

    // 2. Fetch packages for each client
    const promises = clientsSnap.docs.map(async (clientDoc) => {
      const pkgsRef = collection(db, 'companies', getCompanyId(), 'clients', clientDoc.id, 'packages')
      const pkgsSnap = await getDocs(pkgsRef)

      const clientPkgs = []
      for (const d of pkgsSnap.docs) {
        const data = d.data()
        // Filter: only packages with sessions remaining and not cancelled/terminated
        if ((data.sessions_remaining || 0) <= 0) continue
        if (data.status === 'cancelled' || data.status === 'terminated') continue

        const cp = { id: d.id, ...data } as any
        cp.clients = { id: clientDoc.id, ...clientDoc.data() }

        if (data.package_id) {
          const pSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'packages', data.package_id))
          if (pSnap.exists()) cp.packages = { id: pSnap.id, ...pSnap.data() }
        }
        clientPkgs.push(cp)
      }
      return clientPkgs
    })

    const allClientPkgsArrays = await Promise.all(promises)
    for (const arr of allClientPkgsArrays) {
      results.push(...arr)
    }

    if (options?.limit) {
      results = results.slice(0, options.limit)
    }

    return { data: results, error: null }
  } catch (error) {
    console.error("🔥 ERRO EM getAllActiveClientPackages: ", error)
    return { data: null, error }
  }
}


export async function assignPackageToClient(clientId: string, packageId: string, sessions: number, purchaseDate?: Date, discountAmount: number = 0): Promise<{ error: any }> {
  try {
    const pkgsRef = collection(db, 'companies', getCompanyId(), 'clients', clientId, 'packages')
    const newDoc = doc(pkgsRef)
    await setDoc(newDoc, {
      id: newDoc.id,
      client_id: clientId,
      package_id: packageId,
      sessions_remaining: sessions,
      purchase_date: purchaseDate ? purchaseDate.toISOString() : new Date().toISOString(),
      discount_amount: discountAmount
    })
    return { error: null }
  } catch (error) { return { error } }
}


export async function cancelClientPackage(clientId: string, clientPackageId: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'clients', clientId, 'packages', clientPackageId)
    await updateDoc(docRef, { status: 'cancelled', cancelled_at: new Date().toISOString() })
    return { error: null }
  } catch (error) { return { error } }
}

export async function terminateClientPackage(clientId: string, clientPackageId: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'clients', clientId, 'packages', clientPackageId)
    await updateDoc(docRef, { status: 'terminated', terminated_at: new Date().toISOString() })
    return { error: null }
  } catch (error) { return { error } }
}

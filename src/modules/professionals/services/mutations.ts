import { db } from '@/shared/lib/firebase'
import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { Professional } from '@/shared/types'
import { getCompanyId } from '@/shared/lib/tenantStore'
import { secondaryAuth, secondaryDb } from '@/shared/lib/firebase'
import { createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth'

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
    const docRef = doc(db, 'users', id)
    await updateDoc(docRef, { is_active: false, deleted_at: new Date().toISOString() })
    return { error: null }
  } catch (error) {
    return { error }
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
    const finalPassword = data.password || (Math.random().toString(36).slice(-10) + 'A1!')
    
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email, finalPassword)
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
    const professionalDocRef = doc(secondaryDb, 'companies', companyId, 'professionals', user.uid)
    const profData = {
      id: user.uid,
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

    // O secondaryAuth não precisa de signOut explícito.
    
    if (!data.password) {
      try {
        const actionCodeSettings = {
          url: `${window.location.origin}/reset-password`,
          handleCodeInApp: false,
        }
        await sendPasswordResetEmail(secondaryAuth, data.email, actionCodeSettings)
      } catch (emailError: any) {
        console.error('Error sending reset email:', emailError)
      }
    }

    return { data: profData, error: null }
  } catch (error) {
    console.error("Erro ao criar usuário profissional:", error)
    return { data: null, error }
  }
}

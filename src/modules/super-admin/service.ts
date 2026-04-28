import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage, secondaryAuth } from '@/shared/lib/firebase'
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import type { CompanyConfig } from '@/shared/types/tenant'
import { DEFAULT_BRANDING, DEFAULT_ROLES } from '@/shared/types/tenant'
import { MODULE_REGISTRY } from '@/modules/registry'

// ─── Company CRUD ────────────────────────────────────────────────────────────

export async function getAllCompanies(): Promise<{ data: CompanyConfig[] | null; error: any }> {
  try {
    const snap = await getDocs(collection(db, 'companies'))
    const defaultModules = Object.fromEntries(
      MODULE_REGISTRY.map(({ key, label, defaultEnabled }) => [key, { enabled: defaultEnabled, label }])
    ) as CompanyConfig['modules']
    const data = snap.docs.map((d) => {
      const raw = d.data()
      
      const mergedModules = { ...defaultModules }
      if (raw.modules) {
        for (const [k, v] of Object.entries(raw.modules)) {
          const key = k as keyof typeof defaultModules
          if (mergedModules[key] && (v as any)?.hasOwnProperty('enabled')) {
            mergedModules[key].enabled = (v as any).enabled
          }
        }
      }

      return {
        id: d.id,
        name: raw.name ?? d.id,
        slug: raw.slug ?? d.id,
        is_active: raw.is_active ?? false,
        branding: raw.branding ?? { ...DEFAULT_BRANDING },
        modules: mergedModules,
        roles: raw.roles ?? { ...DEFAULT_ROLES },
      } as CompanyConfig
    })
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getCompanyConfig(companyId: string): Promise<{ data: CompanyConfig | null; error: any }> {
  try {
    const snap = await getDoc(doc(db, 'companies', companyId))
    if (!snap.exists()) return { data: null, error: 'not-found' }
    const raw = snap.data()
    const defaultModules = Object.fromEntries(
      MODULE_REGISTRY.map(({ key, label, defaultEnabled }) => [key, { enabled: defaultEnabled, label }])
    ) as CompanyConfig['modules']
    const mergedModules = { ...defaultModules }
    if (raw.modules) {
      for (const [k, v] of Object.entries(raw.modules)) {
        const key = k as keyof typeof defaultModules
        if (mergedModules[key] && (v as any)?.hasOwnProperty('enabled')) {
          mergedModules[key].enabled = (v as any).enabled
        }
      }
    }

    const data: CompanyConfig = {
      id: raw.id ?? companyId,
      name: raw.name ?? companyId,
      slug: raw.slug ?? companyId,
      is_active: raw.is_active ?? false,
      branding: raw.branding ?? { ...DEFAULT_BRANDING },
      modules: mergedModules,
      roles: raw.roles ?? { ...DEFAULT_ROLES },
    }
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function createCompany(
  name: string,
  slug: string,
): Promise<{ data: CompanyConfig | null; error: any }> {
  try {
    const modules = Object.fromEntries(
      MODULE_REGISTRY.map(({ key, label, defaultEnabled }) => [
        key,
        { enabled: defaultEnabled, label },
      ]),
    ) as CompanyConfig['modules']

    const company: CompanyConfig = {
      id: slug,
      name,
      slug,
      is_active: true,
      branding: { ...DEFAULT_BRANDING, app_name: name },
      modules,
      roles: { ...DEFAULT_ROLES },
    }

    await setDoc(doc(db, 'companies', slug), company)
    return { data: company, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function updateCompanyModules(
  companyId: string,
  modules: CompanyConfig['modules'],
): Promise<{ error: any }> {
  try {
    await updateDoc(doc(db, 'companies', companyId), { modules })
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function updateCompanyBranding(
  companyId: string,
  branding: CompanyConfig['branding'],
): Promise<{ error: any }> {
  try {
    await updateDoc(doc(db, 'companies', companyId), { branding })
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function updateCompanyRoles(
  companyId: string,
  roles: CompanyConfig['roles'],
): Promise<{ error: any }> {
  try {
    await updateDoc(doc(db, 'companies', companyId), { roles })
    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function setCompanyActive(
  companyId: string,
  is_active: boolean,
): Promise<{ error: any }> {
  try {
    await updateDoc(doc(db, 'companies', companyId), { is_active })
    return { error: null }
  } catch (error) {
    return { error }
  }
}

// ─── Logo Upload ─────────────────────────────────────────────────────────────

export async function uploadCompanyLogo(
  companyId: string,
  file: File,
): Promise<{ url: string | null; error: any }> {
  try {
    const ext = file.name.split('.').pop()
    const timestamp = Date.now()
    const storageRef = ref(storage, `companies/${companyId}/logo_${timestamp}.${ext}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    return { url, error: null }
  } catch (error) {
    return { url: null, error }
  }
}

// ─── Users ───────────────────────────────────────────────────────────────────

export interface CompanyUser {
  uid: string
  name: string
  email: string
  role: string
  companyId: string
  created_at: string
}

export async function getUsersByCompany(
  companyId: string,
): Promise<{ data: CompanyUser[] | null; error: any }> {
  try {
    const q = query(collection(db, 'users'), where('companyId', '==', companyId))
    const snap = await getDocs(q)
    const data = snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as CompanyUser)
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function updateUserRole(
  uid: string,
  role: string,
): Promise<{ error: any }> {
  try {
    await updateDoc(doc(db, 'users', uid), { role })
    return { error: null }
  } catch (error) {
    return { error }
  }
}

/**
 * Creates a Firebase Auth user WITHOUT signing out the current super-admin.
 * The standard SDK createUserWithEmailAndPassword would sign in the new user,
 * destroying the super-admin session. We use the Identity Toolkit REST API instead.
 * After creation, we write the users/{uid} Firestore doc and send a password-reset
 * email so the new user sets their own password.
 */
export async function createCompanyUser(
  companyId: string,
  name: string,
  email: string,
  role: string,
  password?: string,
): Promise<{ error: any }> {
  try {
    // Step 1: Create Auth user via Secondary SDK (does NOT affect current session)
    // Use provided password or generate a safe temporary one
    const finalPassword = password || (Math.random().toString(36).slice(-10) + 'A1!')
    
    let uid: string
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, finalPassword)
      uid = userCredential.user.uid
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-in-set' || authError.code === 'auth/email-already-exists') {
        throw new Error('Este e-mail já está sendo usado por outro usuário.')
      }
      throw authError
    }

    // Step 2: Write Firestore user doc
    try {
      await setDoc(doc(db, 'users', uid), {
        name,
        email,
        role,
        companyId,
        created_at: new Date().toISOString(),
      })
    } catch (dbError) {
      console.error('Error writing to Firestore:', dbError)
      throw new Error('Usuário criado no Auth, mas falhou ao salvar perfil no banco de dados.')
    }

    // Step 3: Send password-reset email so user sets their own password
    // ONLY if a manual password was NOT provided
    if (!password) {
      try {
        await sendPasswordResetEmail(secondaryAuth, email)
      } catch (emailError: any) {
        console.error('Error sending reset email:', emailError)
        // Custom message for critical failures
        if (emailError.code === 'auth/unauthorized-continue-uri') {
          throw new Error('Usuário criado, mas o domínio não está autorizado para enviar e-mails.')
        }
        throw new Error(`Usuário criado, mas falhou ao enviar e-mail de convite: ${emailError.message}`)
      }
    }

    return { error: null }
  } catch (error: any) {
    console.error('createCompanyUser error:', error)
    return { error: error.message || error }
  }
}

export async function deleteCompanyUser(uid: string): Promise<{ error: any }> {
  try {
    await deleteDoc(doc(db, 'users', uid))
    return { error: null }
  } catch (error) {
    return { error }
  }
}

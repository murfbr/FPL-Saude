import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/shared/lib/firebase'
import type { CompanyConfig } from '@/shared/types/tenant'
import { DEFAULT_BRANDING, DEFAULT_ROLES } from '@/shared/types/tenant'
import { MODULE_REGISTRY } from '@/modules/registry'

// ─── Company CRUD ────────────────────────────────────────────────────────────

export async function getAllCompanies(): Promise<{ data: CompanyConfig[] | null; error: any }> {
  try {
    const snap = await getDocs(collection(db, 'companies'))
    const data = snap.docs.map((d) => d.data() as CompanyConfig)
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getCompanyConfig(companyId: string): Promise<{ data: CompanyConfig | null; error: any }> {
  try {
    const snap = await getDoc(doc(db, 'companies', companyId))
    if (!snap.exists()) return { data: null, error: 'not-found' }
    return { data: snap.data() as CompanyConfig, error: null }
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
    const storageRef = ref(storage, `companies/${companyId}/logo.${ext}`)
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
  apiKey: string,
): Promise<{ error: any }> {
  try {
    // Step 1: Create Auth user via REST (does NOT affect current session)
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: tempPassword, returnSecureToken: false }),
      },
    )
    if (!res.ok) {
      const body = await res.json()
      throw new Error(body?.error?.message ?? 'Falha ao criar usuário.')
    }
    const { localId: uid } = await res.json()

    // Step 2: Write Firestore user doc
    await setDoc(doc(db, 'users', uid), {
      name,
      email,
      role,
      companyId,
      created_at: new Date().toISOString(),
    })

    // Step 3: Send password-reset email so user sets their own password
    await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
      },
    )

    return { error: null }
  } catch (error) {
    return { error }
  }
}

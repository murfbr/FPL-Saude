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
import { db, storage, auth } from '@/shared/lib/firebase'
import { sendPasswordResetEmail } from 'firebase/auth'
import { callCreateStaffUser, callSetStaffActive } from '@/shared/lib/functions'
import type { CompanyConfig, CompanyFeatures } from '@/shared/types/tenant'
import { DEFAULT_BRANDING, DEFAULT_ROLES, DEFAULT_FEATURES } from '@/shared/types/tenant'
import { MODULE_REGISTRY } from '@/modules/registry'

// ─── Legacy Migration Helper ───────────────────────────────────────────────────

function parseCompanyRoles(rawRoles: any, rawFeatures: any) {
  const roles = rawRoles ? JSON.parse(JSON.stringify(rawRoles)) : { ...DEFAULT_ROLES }
  
  // Migrate legacy global professional features to the 'professional' role
  if (rawFeatures && roles.professional && !roles.professional.features) {
    roles.professional.features = []
    if (rawFeatures.professionals_view_all_schedules) roles.professional.features.push('view_all_schedules')
    if (rawFeatures.professionals_view_all_clients) roles.professional.features.push('view_all_clients')
    if (rawFeatures.professionals_can_manage_packages) roles.professional.features.push('manage_packages')
    if (rawFeatures.professionals_can_reschedule) roles.professional.features.push('reschedule')
    if (rawFeatures.professionals_can_view_financials) roles.professional.features.push('view_financials')
  }

  // Ensure all roles have a features array to prevent undefined errors in UI
  for (const key of Object.keys(roles)) {
    if (!roles[key].features) {
       roles[key].features = key === 'admin' 
         ? ['view_all_schedules', 'view_all_clients', 'manage_packages', 'reschedule', 'view_financials'] 
         : []
    }
  }
  return roles
}

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
        roles: parseCompanyRoles(raw.roles, raw.features),
        features: { ...DEFAULT_FEATURES, ...(raw.features || {}) },
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
      roles: parseCompanyRoles(raw.roles, raw.features),
      features: { ...DEFAULT_FEATURES, ...(raw.features || {}) },
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
    // O slug é o ID do documento: sem esta checagem, um slug repetido
    // sobrescreveria a empresa existente (roles, branding, módulos)
    const existing = await getDoc(doc(db, 'companies', slug))
    if (existing.exists()) {
      return { data: null, error: new Error(`Já existe uma empresa com o slug "${slug}".`) }
    }

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
      features: { ...DEFAULT_FEATURES },
    }

    await setDoc(doc(db, 'companies', slug), company)
    await syncPublicBranding(company)
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

/**
 * Espelho público do branding em public_branding/{slug} — a tela de login
 * precisa de logo/cores por slug ANTES da autenticação, e o doc da empresa
 * (companies/{id}) exige auth. Aqui vai apenas dado de vitrine.
 * Não-fatal: falha aqui não pode derrubar o save principal.
 */
async function syncPublicBranding(company: {
  id: string
  slug: string
  name: string
  is_active?: boolean
  branding: CompanyConfig['branding']
}): Promise<void> {
  try {
    await setDoc(doc(db, 'public_branding', company.slug), {
      company_id: company.id,
      slug: company.slug,
      name: company.name,
      is_active: company.is_active !== false,
      branding: company.branding,
      updated_at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('Falha ao sincronizar public_branding', e)
  }
}

export async function updateCompanyBranding(
  companyId: string,
  branding: CompanyConfig['branding'],
): Promise<{ error: any }> {
  try {
    await updateDoc(doc(db, 'companies', companyId), { branding })

    const snap = await getDoc(doc(db, 'companies', companyId))
    if (snap.exists()) {
      const data = snap.data() as CompanyConfig
      await syncPublicBranding({ id: companyId, slug: data.slug, name: data.name, is_active: data.is_active, branding })
    }
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

export async function updateCompanyFeatures(
  companyId: string,
  features: CompanyFeatures,
): Promise<{ error: any }> {
  try {
    await updateDoc(doc(db, 'companies', companyId), { features })
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
 * Cria usuário para uma empresa via Cloud Function (Admin SDK): Auth + perfis
 * atomicamente, com rollback — sem deslogar o super-admin e sem esbarrar nas
 * rules. Depois envia o convite de senha (falha aparece, não é engolida).
 */
export async function createCompanyUser(
  companyId: string,
  name: string,
  email: string,
  role: string,
  password?: string,
): Promise<{ error: any }> {
  try {
    await callCreateStaffUser({
      companyId,
      name,
      email,
      password: password || null,
      role,
    })

    // Convite para definir senha — apenas quando não houve senha manual
    if (!password) {
      try {
        const actionCodeSettings = {
          url: `${window.location.origin}/reset-password`,
          handleCodeInApp: false,
        }
        await sendPasswordResetEmail(auth, email, actionCodeSettings)
      } catch (emailError: any) {
        console.error('Error sending reset email:', emailError)
        throw new Error(
          'Usuário criado, mas o e-mail de convite falhou. Peça para usar "Esqueci minha senha" na tela de login.',
        )
      }
    }

    return { error: null }
  } catch (error: any) {
    console.error('createCompanyUser error:', error)
    return { error: error?.message || error }
  }
}

/**
 * Desativa o ACESSO de um usuário da empresa (congela a conta — nada é apagado).
 * Substitui o antigo deleteCompanyUser, que removia o perfil e deixava o login vivo.
 */
export async function deactivateCompanyUser(
  companyId: string,
  uid: string,
): Promise<{ error: any }> {
  try {
    await callSetStaffActive({ companyId, userId: uid, active: false })
    return { error: null }
  } catch (error: any) {
    return { error: new Error(error?.message || 'Falha ao desativar o usuário.') }
  }
}

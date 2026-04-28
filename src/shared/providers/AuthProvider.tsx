import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from 'react'

import { auth as firebaseAuth, db as firebaseDb } from '@/shared/lib/firebase'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updatePassword as firebaseUpdatePassword
} from 'firebase/auth'
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore'
import { setCompanyId, getCompanyId } from '@/shared/lib/tenantStore'

export type UserRole = 'client' | 'professional' | 'admin' | string

export interface AppUser {
  id: string
  email?: string
  displayName?: string | null
}

export interface AppSession {
  access_token: string
}

interface AuthContextType {
  user: AppUser | null
  session: AppSession | null
  role: UserRole | null
  professionalId: string | null
  companyId: string | null
  signUp: (email: string, password: string, companyId?: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
  resetPasswordForEmail: (email: string) => Promise<{ error: any }>
  updatePassword: (password: string) => Promise<{ error: any }>
  loading: boolean
  error: Error | null
  refreshProfile: () => Promise<void>
  impersonateCompany: (companyId: string | null) => void
  isImpersonating: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

const MAX_RETRIES = 2
const RETRY_DELAY = 500

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null)
  const [session, setSession] = useState<AppSession | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [professionalId, setProfessionalId] = useState<string | null>(null)
  const [companyId, setCompanyIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [impersonatedCompanyId, setImpersonatedCompanyIdState] = useState<string | null>(
    localStorage.getItem('fpl_impersonated_company')
  )

  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const fetchProfileAndRole = useCallback(async (currentUser: AppUser | null) => {
    if (!currentUser) {
      if (isMounted.current) {
        setRole(null)
        setProfessionalId(null)
        setCompanyIdState(null)
        setCompanyId(null)
        setLoading(false)
        setError(null)
      }
      return
    }

    let attempts = 0
    let success = false
    let lastError: any = null

    while (attempts <= MAX_RETRIES && !success) {
      try {
        // Check super_admins/{uid} first — if found and active, skip tenant lookup
        const superAdminRef = doc(firebaseDb, 'super_admins', currentUser.id)
        const superAdminSnap = await getDoc(superAdminRef)
        if (superAdminSnap.exists() && superAdminSnap.data()?.is_active === true) {
          if (isMounted.current) {
            setRole('super_admin')
            setProfessionalId(null)
            setCompanyIdState(null)
            setCompanyId(null)
            setError(null)
            setLoading(false)
          }
          success = true
          break
        }

        // Read from root users/{uid} collection — tenant-agnostic lookup
        const docRef = doc(firebaseDb, 'users', currentUser.id)
        const docSnap = await getDoc(docRef)

        if (!docSnap.exists()) {
          throw new Error('Perfil de usuário não encontrado no sistema.')
        }

        const userData = docSnap.data()
        const userRole = userData?.role as UserRole
        const resolvedCompanyId = userData?.companyId as string

        if (!resolvedCompanyId) {
          throw new Error('Empresa do usuário não configurada.')
        }

        // Resolve professional ID from the company's professionals collection
        let profId = null
        if (userRole === 'professional' || userRole === 'admin') {
          const profQuery = query(
            collection(firebaseDb, 'companies', resolvedCompanyId, 'professionals'),
            where('user_id', '==', currentUser.id)
          )
          const profDocs = await getDocs(profQuery)
          if (!profDocs.empty) profId = profDocs.docs[0].id
        }

        if (isMounted.current) {
          setRole(userRole)
          setProfessionalId(profId)
          setCompanyIdState(resolvedCompanyId)
          setCompanyId(resolvedCompanyId) // sync to module-level store for services
          setError(null)
          setLoading(false)
        }
        success = true
      } catch (err: any) {
        lastError = err
        attempts++
        if (attempts <= MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
        }
      }
    }

    if (!success && isMounted.current) {
      setError(lastError || new Error('Falha ao carregar perfil.'))
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if (!isMounted.current) return
      if (fbUser) {
        const appUser: AppUser = { id: fbUser.uid, email: fbUser.email || undefined, displayName: fbUser.displayName }
        setSession({ access_token: await fbUser.getIdToken() })
        setUser(appUser)

        setLoading(true)
        await fetchProfileAndRole(appUser)
      } else {
        setSession(null)
        setUser(null)
        setRole(null)
        setProfessionalId(null)
        setCompanyIdState(null)
        setCompanyId(null) // clear module-level store on sign out
        setLoading(false)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [fetchProfileAndRole])

  const impersonateCompany = useCallback((id: string | null) => {
    setImpersonatedCompanyIdState(id)
    if (id) {
      localStorage.setItem('fpl_impersonated_company', id)
      setCompanyId(id) // sync to module-level store
    } else {
      localStorage.removeItem('fpl_impersonated_company')
      setCompanyId(companyId) // revert to original resolved company
    }
  }, [companyId])

  // signUp writes to root users/{uid} with companyId.
  // companyId defaults to the current resolved company.
  // manages company assignment automatically.
  const signUp = async (email: string, password: string, targetCompanyId?: string) => {
    try {
      const finalCompanyId = targetCompanyId || companyId || getCompanyId()
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password)
      const docRef = doc(firebaseDb, 'users', cred.user.uid)
      await setDoc(docRef, {
        name: email.split('@')[0],
        email,
        role: 'client',
        companyId: finalCompanyId,
        created_at: new Date().toISOString(),
      })
      return { error: null }
    } catch (e) {
      return { error: e }
    }
  }

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    console.log('[Auth] Attempting sign in for:', email)

    let attempts = 0
    const SIGNIN_MAX_RETRIES = 1

    while (attempts <= SIGNIN_MAX_RETRIES) {
      try {
        await signInWithEmailAndPassword(firebaseAuth, email, password)
        console.log('[Auth] Sign in successful')
        return { error: null }
      } catch (error: any) {
        attempts++
        const isTransient =
          error.code === 'auth/network-request-failed' ||
          error.code === 'auth/internal-error' ||
          error.code === 'auth/too-many-requests'

        if (isTransient && attempts <= SIGNIN_MAX_RETRIES) {
          console.warn(`[Auth] Transient sign in error (attempt ${attempts}):`, error.code, 'Retrying...')
          await new Promise((resolve) => setTimeout(resolve, 1000))
          continue
        }

        console.error('[Auth] Sign in failed:', error.code || error.message)
        setLoading(false)
        setError(error as Error)
        return { error }
      }
    }
    return { error: new Error('Falha na autenticação após várias tentativas.') }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      await firebaseSignOut(firebaseAuth)
    } catch (e: any) {
      setError(e)
    } finally {
      if (isMounted.current) {
        setSession(null)
        setUser(null)
        setRole(null)
        setProfessionalId(null)
        setCompanyIdState(null)
        setCompanyId(null)
        setError(null)
        setLoading(false)
        // Also clear impersonation on sign out
        localStorage.removeItem('fpl_impersonated_company')
        setImpersonatedCompanyIdState(null)
      }
    }
    return { error: null }
  }

  const resetPasswordForEmail = async (email: string) => {
    try {
      await sendPasswordResetEmail(firebaseAuth, email)
      return { error: null }
    } catch (error) {
       return { error }
    }
  }

  const updatePassword = async (password: string) => {
    try {
      if (firebaseAuth.currentUser) {
        await firebaseUpdatePassword(firebaseAuth.currentUser, password)
      }
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const refreshProfile = async () => {
    if (user) {
      setLoading(true)
      await fetchProfileAndRole(user)
    }
  }

  const value = {
    user,
    session,
    role,
    professionalId,
    companyId: impersonatedCompanyId || companyId,
    isImpersonating: !!impersonatedCompanyId,
    signUp,
    signIn,
    signOut,
    resetPasswordForEmail,
    updatePassword,
    loading,
    error,
    refreshProfile,
    impersonateCompany,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

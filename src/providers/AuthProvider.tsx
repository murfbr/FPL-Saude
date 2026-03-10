import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from 'react'
import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/types'

import { auth as firebaseAuth, db as firebaseDb } from '@/lib/firebase'
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  sendPasswordResetEmail, 
  updatePassword as firebaseUpdatePassword 
} from 'firebase/auth'
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore'

const isFirebase = import.meta.env.VITE_DB_PROVIDER === 'firebase'
const COMPANY_ID = 'fpl-saude'

export type UserRole = Database['public']['Enums']['user_role'] | string

// Generic internal types
export interface AppUser {
  id: string
  email?: string
}

export interface AppSession {
  access_token: string
}

interface AuthContextType {
  user: AppUser | null
  session: AppSession | null
  role: UserRole | null
  professionalId: string | null
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
  resetPasswordForEmail: (email: string) => Promise<{ error: any }>
  updatePassword: (password: string) => Promise<{ error: any }>
  loading: boolean
  error: Error | null
  refreshProfile: () => Promise<void>
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
const RETRY_DELAY = 500 // ms

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null)
  const [session, setSession] = useState<AppSession | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [professionalId, setProfessionalId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

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
        console.log(`[Auth Factory] Fetching profile for user: ${currentUser.id} (Attempt ${attempts + 1}) [Firebase Mode: ${isFirebase}]`)

        let userRole = null as UserRole | null;
        let profId = null;

        if (isFirebase) {
          // Firebase Implementation
          const docRef = doc(firebaseDb, 'companies', COMPANY_ID, 'users', currentUser.id)
          const docSnap = await getDoc(docRef)
          
          if (!docSnap.exists()) {
            throw new Error('Perfil de usuário não encontrado no Firestore.')
          }
          userRole = docSnap.data()?.role as UserRole
          console.log('[Auth] Firebase Profile found. Role:', userRole)

          // Fetch Professional ID if applicable
          if (userRole === 'professional' || userRole === 'admin') {
            const profQuery = query(collection(firebaseDb, 'companies', COMPANY_ID, 'professionals'), where('user_id', '==', currentUser.id))
            const profDocs = await getDocs(profQuery)
            if (!profDocs.empty) profId = profDocs.docs[0].id
          }

        } else {
          // Supabase Implementation
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .maybeSingle()

          if (profileError) throw profileError
          if (!profileData) throw new Error('Perfil de usuário não encontrado no sistema Supabase.')

          userRole = profileData.role
          
          if (userRole === 'professional' || userRole === 'admin') {
            const { data: profData, error: profError } = await supabase
              .from('professionals')
              .select('id')
              .eq('user_id', currentUser.id)
              .maybeSingle()
            if (profData) profId = profData.id
          }
        }

        if (isMounted.current) {
          setRole(userRole)
          setProfessionalId(profId)
          setError(null)
          setLoading(false)
        }
        success = true
      } catch (err: any) {
        console.error(`[Auth] Attempt ${attempts + 1} failed:`, err)
        lastError = err
        attempts++
        if (attempts <= MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
        }
      }
    }

    if (!success && isMounted.current) {
      console.error('[Auth] All attempts to fetch profile failed.')
      setError(lastError || new Error('Falha ao carregar perfil.'))
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let unsubscribe: () => void = () => {}

    if (isFirebase) {
      // FIREBASE AUTH LISTENER
      unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
        if (!isMounted.current) return
        if (fbUser) {
          const appUser: AppUser = { id: fbUser.uid, email: fbUser.email || undefined }
          setSession({ access_token: await fbUser.getIdToken() })
          setUser(appUser)
          
          if (!role || user?.id !== appUser.id) {
            setLoading(true)
            await fetchProfileAndRole(appUser)
          } else {
            setLoading(false)
          }
        } else {
          setSession(null)
          setUser(null)
          setRole(null)
          setProfessionalId(null)
          setLoading(false)
        }
      })
    } else {
      // SUPABASE AUTH LISTENER
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
        if (!isMounted.current) return
        
        if (event === 'SIGNED_OUT') {
           setSession(null)
           setUser(null)
           setRole(null)
           setProfessionalId(null)
           setLoading(false)
           localStorage.removeItem('sb-fpl-saude-auth-token')
        } else if (currentSession?.user) {
           const appUser: AppUser = { id: currentSession.user.id, email: currentSession.user.email }
           setSession({ access_token: currentSession.access_token })
           setUser(appUser)
           
           if (!role || user?.id !== appUser.id) {
             setLoading(true)
             fetchProfileAndRole(appUser)
           } else {
             setLoading(false)
           }
        }
      })
      unsubscribe = () => subscription.unsubscribe()

      // Initial supabase check
      supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
        if (!isMounted.current) return
        if (initialSession?.user) {
          const appUser: AppUser = { id: initialSession.user.id, email: initialSession.user.email }
          setSession({ access_token: initialSession.access_token })
          setUser(appUser)
          fetchProfileAndRole(appUser)
        } else {
          setLoading(false)
        }
      })
    }

    return () => {
      unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Remove explicit dependency on role to avoid listener leaks

  const signUp = async (email: string, password: string) => {
    try {
      if (isFirebase) {
        const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password)
        // Automatically create user profile document based on form signup
        const docRef = doc(firebaseDb, 'companies', COMPANY_ID, 'users', cred.user.uid)
        await setDoc(docRef, { name: email.split('@')[0], email, role: 'client', created_at: new Date().toISOString() })
        return { error: null }
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        return { error }
      }
    } catch (e) {
      return { error: e }
    }
  }

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      let err = null
      if (isFirebase) {
        await signInWithEmailAndPassword(firebaseAuth, email, password)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) err = error
      }
      if (err) throw err
      return { error: null }
    } catch (error) {
      setLoading(false)
      setError(error as Error)
      return { error }
    }
  }

  const signOut = async () => {
    console.log('[Auth] Signing out...')
    setLoading(true)
    try {
      if (isFirebase) {
        await firebaseSignOut(firebaseAuth)
      } else {
        await supabase.auth.signOut()
      }
    } catch (e: any) {
      console.error('[Auth] Error signing out:', e)
      setError(e)
    } finally {
      if (isMounted.current) {
        setSession(null)
        setUser(null)
        setRole(null)
        setProfessionalId(null)
        setError(null)
        setLoading(false)
      }
    }
    return { error: null }
  }

  const resetPasswordForEmail = async (email: string) => {
    try {
      if (isFirebase) {
        await sendPasswordResetEmail(firebaseAuth, email)
        return { error: null }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/update-password` })
        return { error }
      }
    } catch (error) {
       return { error }
    }
  }

  const updatePassword = async (password: string) => {
    try {
      if (isFirebase) {
        if (firebaseAuth.currentUser) {
          await firebaseUpdatePassword(firebaseAuth.currentUser, password)
        }
        return { error: null }
      } else {
        const { error } = await supabase.auth.updateUser({ password })
        return { error }
      }
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
    signUp,
    signIn,
    signOut,
    resetPasswordForEmail,
    updatePassword,
    loading,
    error,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

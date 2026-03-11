import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from 'react'

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

const COMPANY_ID = 'fpl-saude'

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
const RETRY_DELAY = 500

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
        let userRole = null as UserRole | null;
        let profId = null;

        const docRef = doc(firebaseDb, 'companies', COMPANY_ID, 'users', currentUser.id)
        const docSnap = await getDoc(docRef)
        
        if (!docSnap.exists()) {
          throw new Error('Perfil de usuário não encontrado no sistema.')
        }
        
        userRole = docSnap.data()?.role as UserRole

        if (userRole === 'professional' || userRole === 'admin') {
          const profQuery = query(collection(firebaseDb, 'companies', COMPANY_ID, 'professionals'), where('user_id', '==', currentUser.id))
          const profDocs = await getDocs(profQuery)
          if (!profDocs.empty) profId = profDocs.docs[0].id
        }

        if (isMounted.current) {
          setRole(userRole)
          setProfessionalId(profId)
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
        setLoading(false)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [fetchProfileAndRole])

  const signUp = async (email: string, password: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password)
      const docRef = doc(firebaseDb, 'companies', COMPANY_ID, 'users', cred.user.uid)
      await setDoc(docRef, { name: email.split('@')[0], email, role: 'client', created_at: new Date().toISOString() })
      return { error: null }
    } catch (e) {
      return { error: e }
    }
  }

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password)
      return { error: null }
    } catch (error) {
      setLoading(false)
      setError(error as Error)
      return { error }
    }
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
        setError(null)
        setLoading(false)
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

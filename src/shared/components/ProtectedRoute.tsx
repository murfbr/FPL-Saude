import { ReactNode, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/shared/providers/AuthProvider'
import { UserRole } from '@/shared/providers/AuthProvider'
import {
  Loader2,
  LogOut,
  AlertTriangle,
  RefreshCw,
  WifiOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: UserRole[]
}

const TIMEOUT_MS = 10000 // 10 seconds timeout

export const ProtectedRoute = ({
  children,
  allowedRoles,
}: ProtectedRouteProps) => {
  const { user, role, loading, error, signOut, refreshProfile } = useAuth()
  const location = useLocation()

  const [showLongLoadingMessage, setShowLongLoadingMessage] = useState(false)
  const [isTimedOut, setIsTimedOut] = useState(false)

  useEffect(() => {
    let timer1: NodeJS.Timeout
    let timer2: NodeJS.Timeout

    if (loading) {
      // 1. Show "waiting" message after 2 seconds (slightly faster feedback)
      timer1 = setTimeout(() => setShowLongLoadingMessage(true), 2000)

      // 2. Force timeout state after 10 seconds
      timer2 = setTimeout(() => setIsTimedOut(true), TIMEOUT_MS)
    } else {
      setShowLongLoadingMessage(false)
      setIsTimedOut(false)
    }

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [loading])

  const handleForceLogout = async () => {
    await signOut()
    window.location.href = '/login'
  }

  // 1. Error State
  if (error || isTimedOut) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 animate-fade-in">
        <div className="w-full max-w-md space-y-4">
          <Alert variant="destructive">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>Erro de Conexão</AlertTitle>
            <AlertDescription>
              {error
                ? error.message
                : 'Demora na resposta do servidor. Verifique sua conexão.'}
            </AlertDescription>
          </Alert>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => {
                setIsTimedOut(false)
                refreshProfile()
              }}
              variant="outline"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar Novamente
            </Button>
            <Button onClick={handleForceLogout} variant="destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // 2. Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background space-y-6 p-4">
        <div className="flex flex-col items-center space-y-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="space-y-2">
            <p className="text-muted-foreground animate-pulse text-sm">
              {showLongLoadingMessage ? (
                <span className="flex items-center justify-center gap-2 text-orange-600 font-medium">
                  Sincronizando dados...
                </span>
              ) : (
                'Verificando perfil...'
              )}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 3. Authentication Check
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 4. Role Integrity Check
  if (!role) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
        <div className="bg-destructive/10 p-4 rounded-full mb-4">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <h2 className="text-xl font-bold mb-2">Erro de Perfil</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Não foi possível identificar seu nível de acesso. Por favor, entre em
          contato com o suporte.
        </p>
        <div className="flex gap-4">
          <Button onClick={() => window.location.reload()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Recarregar
          </Button>
          <Button onClick={handleForceLogout} variant="destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    )
  }

  // 5. Super-admin redirect — keep them in their own area
  if (role === 'super_admin' && !location.pathname.startsWith('/super-admin')) {
    return <Navigate to="/super-admin" replace />
  }

  // 6. Role Authorization Check
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/access-denied" replace />
  }

  // 7. Render Authorized Content
  return <>{children}</>
}

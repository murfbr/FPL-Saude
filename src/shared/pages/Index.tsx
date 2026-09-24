import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/shared/providers/AuthProvider'
import { getHomeRoute } from '@/shared/lib/roles'
import { Loader2 } from 'lucide-react'

const Index = () => {
  const { role, user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // Wait for loading to finish
    if (loading) return

    // If no user, redirect to login
    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    // If user exists but role is missing, we shouldn't redirect to client-unavailable yet.
    // The ProtectedRoute wrapping this component handles the "No Profile Found" UI.
    // However, if we reach here, role *should* be present because of ProtectedRoute checks.
    if (!role) {
      // Should effectively be unreachable if ProtectedRoute is doing its job
      return
    }

    // Role-based Redirection — papéis customizados (staff) caem no portal
    console.log('[Index] Redirecting based on role:', role)
    navigate(getHomeRoute(role), { replace: true })
  }, [role, user, loading, navigate])

  return (
    <div className="container mx-auto py-8 px-4 flex flex-col items-center justify-center min-h-[50vh]">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground animate-pulse">
        Redirecionando para seu painel...
      </p>
    </div>
  )
}

export default Index

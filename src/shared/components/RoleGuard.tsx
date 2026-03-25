import { Navigate } from 'react-router-dom'
import { useAuth } from '@/shared/providers/AuthProvider'
import { UserRole } from '@/shared/providers/AuthProvider'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
}

export const RoleGuard = ({ children, allowedRoles }: RoleGuardProps) => {
  const { role } = useAuth()

  // This component assumes Auth is already verified by a parent ProtectedRoute
  // Super Admins bypass role checks (they have universal access)
  if (!role || (role !== 'super_admin' && !allowedRoles.includes(role))) {
    return <Navigate to="/access-denied" replace />
  }

  return <>{children}</>
}

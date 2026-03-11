import { Navigate } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'
import { UserRole } from '@/providers/AuthProvider'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
}

export const RoleGuard = ({ children, allowedRoles }: RoleGuardProps) => {
  const { role } = useAuth()

  // This component assumes Auth is already verified by a parent ProtectedRoute
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/access-denied" replace />
  }

  return <>{children}</>
}

import { Navigate } from 'react-router-dom'
import { useAuth, UserRole } from '@/shared/providers/AuthProvider'
import { usePermission } from '@/shared/hooks/usePermission'
import { isStaffRole } from '@/shared/lib/roles'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles?: UserRole[] // Deprecated, mantido por retrocompatibilidade temporária
  module?: string
  action?: 'view' | 'edit'
  /** Aceita qualquer papel de equipe (≠ client), inclusive customizados */
  requireStaff?: boolean
}

export const RoleGuard = ({ children, allowedRoles, module, action = 'view', requireStaff }: RoleGuardProps) => {
  const { role } = useAuth()
  const hasModuleAccess = usePermission(module || '', action)

  // Super Admins sempre bypassam
  if (role === 'super_admin') return <>{children}</>

  if (module) {
    if (!hasModuleAccess) return <Navigate to="/access-denied" replace />
  } else if (requireStaff) {
    if (!isStaffRole(role)) return <Navigate to="/access-denied" replace />
  } else if (allowedRoles) {
    // Fallback retroativo para componentes que ainda usam allowedRoles hardcoded
    if (!role || !allowedRoles.includes(role)) {
      return <Navigate to="/access-denied" replace />
    }
  } else {
     // Se não passar nem module nem allowedRoles, nega por segurança
     return <Navigate to="/access-denied" replace />
  }

  return <>{children}</>
}

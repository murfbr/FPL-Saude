import { useAuth } from '@/shared/providers/AuthProvider'
import { useTenant } from '@/shared/contexts/TenantContext'
import type { RoleFeatureKey } from '@/shared/types/tenant'

export const usePermission = (moduleName: string, action: 'view' | 'edit' = 'view') => {
  const { role } = useAuth()
  const { config, isSuperAdmin } = useTenant()

  if (isSuperAdmin) return true
  if (role === 'admin') return true // Default admin bypass, similar to Firestore rules
  if (!role || !config) return false

  const companyRoles = config.roles
  if (!companyRoles || !(role in companyRoles)) return false

  const rolePerms = companyRoles[role]
  const allowedModules = action === 'edit' ? rolePerms.can_edit : rolePerms.can_view

  return allowedModules.includes(moduleName) || allowedModules.includes('*')
}

export const useFeature = (featureKey: RoleFeatureKey) => {
  const { role } = useAuth()
  const { config, isSuperAdmin } = useTenant()

  if (isSuperAdmin) return true
  if (role === 'admin') return true
  if (!role || !config) return false

  const companyRoles = config.roles
  if (!companyRoles || !(role in companyRoles)) return false

  const rolePerms = companyRoles[role]
  const allowedFeatures = rolePerms.features || []

  return allowedFeatures.includes(featureKey as any) // Typecast is necessary because typescript might complain about the exact literal match depending on tsconfig
}

import { ReactNode } from 'react'
import { TenantContext } from '@/shared/contexts/TenantContext'
import { useAuth } from '@/shared/providers/AuthProvider'

/**
 * TenantProvider — thin wrapper for Phase 1.
 * Reads companyId from AuthProvider (which resolves it from root users/{uid}).
 * Will be expanded in Phase 3 to handle super-admin and per-company config loading.
 */
export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const { companyId, role, loading, error } = useAuth()

  return (
    <TenantContext.Provider
      value={{
        companyId,
        isSuperAdmin: role === 'super_admin',
        tenantLoading: loading,
        tenantError: error,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

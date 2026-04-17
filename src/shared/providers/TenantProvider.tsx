import { ReactNode, useEffect, useState } from 'react'
import { TenantContext } from '@/shared/contexts/TenantContext'
import { useAuth } from '@/shared/providers/AuthProvider'
import { getCompanyConfig } from '@/modules/super-admin/service'
import type { CompanyConfig } from '@/shared/types/tenant'

/**
 * TenantProvider — Resolves tenant data from companyId
 * Loads the tenant's exact configuration including branding and modules
 */
export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const { companyId, role, loading: authLoading, error: authError } = useAuth()
  const [config, setConfig] = useState<CompanyConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [configError, setConfigError] = useState<Error | null>(null)

  useEffect(() => {
    let isMounted = true
    const fetchConfig = async () => {
      if (!companyId) {
        if (isMounted) {
          setConfig(null)
          setConfigLoading(false)
        }
        return
      }

      setConfigLoading(true)
      const { data, error } = await getCompanyConfig(companyId)
      
      if (!isMounted) return

      if (error) {
        setConfigError(new Error(String(error)))
      } else if (data) {
        setConfig(data)
      }
      setConfigLoading(false)
    }

    fetchConfig()

    return () => {
      isMounted = false
    }
  }, [companyId])

  return (
    <TenantContext.Provider
      value={{
        companyId,
        config,
        isSuperAdmin: role === 'super_admin',
        tenantLoading: authLoading || configLoading,
        tenantError: authError || configError,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

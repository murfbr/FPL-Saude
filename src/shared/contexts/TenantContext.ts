import { createContext, useContext } from 'react'
import type { CompanyConfig } from '@/shared/types/tenant'

export interface TenantContextType {
  companyId: string | null
  config: CompanyConfig | null
  isSuperAdmin: boolean
  tenantLoading: boolean
  tenantError: Error | null
}

export const TenantContext = createContext<TenantContextType | undefined>(undefined)

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}

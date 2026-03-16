import { createContext, useContext } from 'react'

export interface TenantContextType {
  companyId: string | null
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

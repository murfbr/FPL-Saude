import { useEffect, useState } from 'react'
import FPLLanding from '@/modules/landing/pages/FPLLanding'
import SaaSLanding from '@/modules/landing/pages/SaaSLanding'

export function DomainRouter() {
  const [isTenant, setIsTenant] = useState<boolean | null>(null)

  useEffect(() => {
    const hostname = window.location.hostname
    
    // Check if the domain is for a specific tenant (like fpl.clinicaespecialista.com.br or fpl.localhost)
    // We assume any subdomain that is not 'www' is a tenant.
    // For now, we specifically check for 'fpl.' to route to the old landing,
    // but this could be expanded to look up the tenant in the database.
    const isFplTenant = hostname.startsWith('fpl.') || hostname === 'fpl-saude.vercel.app'
    
    setIsTenant(isFplTenant)
  }, [])

  // Show nothing while determining domain to avoid hydration mismatch/flicker
  if (isTenant === null) {
    return null
  }

  return isTenant ? <FPLLanding /> : <SaaSLanding />
}

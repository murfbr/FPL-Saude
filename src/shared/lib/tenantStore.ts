/**
 * Module-level tenant store.
 * Services call getCompanyId() to get the current tenant's company ID.
 * AuthProvider calls setCompanyId() after resolving the user's company.
 */

let _companyId: string | null = null

export const getCompanyId = (): string => {
  if (!_companyId) throw new Error('Company ID not resolved yet')
  return _companyId
}

export const setCompanyId = (id: string | null) => {
  _companyId = id
}

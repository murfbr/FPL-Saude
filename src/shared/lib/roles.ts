// Papéis (roles) são dinâmicos por empresa: além de admin/professional/client,
// o super-admin pode criar níveis customizados (ex.: coordenador) na matriz
// companies/{id}.roles. Estes helpers são o único lugar que decide "quem é
// equipe" e "qual a home de cada papel" — nunca compare com listas fixas de
// nomes de papel fora daqui.
import type { UserRole } from '@/shared/providers/AuthProvider'

/** Qualquer papel de equipe da clínica (inclusive customizados). */
export const isStaffRole = (role: UserRole | null | undefined): boolean =>
  !!role && role !== 'client' && role !== 'super_admin'

/**
 * Quem opera a UI de administração da clínica: o admin dela e o super-admin
 * (que entra no app pelo painel e tem os mesmos poderes no backend).
 */
export const isAdminRole = (role: UserRole | null | undefined): boolean =>
  role === 'admin' || role === 'super_admin'

/** Rota inicial de cada papel após autenticação. */
export const getHomeRoute = (role: UserRole | null | undefined): string => {
  if (role === 'super_admin') return '/super-admin'
  if (role === 'admin') return '/admin'
  if (isStaffRole(role)) return '/profissional'
  // client e papéis desconhecidos: a área do paciente ainda não existe
  return '/cliente-indisponivel'
}

const DEFAULT_ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  professional: 'Profissional',
  client: 'Cliente',
  super_admin: 'Super Admin',
}

/** Nome de exibição do papel; slugs customizados viram Título (ex.: coordenador → Coordenador). */
export const getRoleLabel = (role: string | null | undefined): string => {
  if (!role) return '—'
  return (
    DEFAULT_ROLE_LABELS[role] ||
    role.replace(/_/g, ' ').replace(/(^|\s)\S/g, (c) => c.toUpperCase())
  )
}

/**
 * Papéis atribuíveis pela gestão de profissionais: os padrões de equipe +
 * customizados da matriz da empresa. client/super_admin nunca entram.
 */
export const listAssignableRoles = (
  companyRoles?: Record<string, unknown> | null,
): string[] => {
  const custom = Object.keys(companyRoles || {})
    .filter((r) => !['admin', 'professional', 'client', 'super_admin'].includes(r))
    .sort((a, b) => a.localeCompare(b))
  return ['professional', 'admin', ...custom]
}

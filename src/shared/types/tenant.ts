export type ModuleKey =
  | 'overview'
  | 'appointments'
  | 'kpi'
  | 'financial'
  | 'professionals'
  | 'clients'
  | 'time_tracking'
  | 'notifications'
  | 'services'
  | 'partnerships'
  | 'maintenance'
  | 'gallery'

export interface CompanyBranding {
  logo_url: string
  app_name: string
  primary_hex: string
  secondary_hex: string
  accent_hex: string
  background_hex: string
  foreground_hex: string
}

export interface ModuleConfig {
  enabled: boolean
  label: string
}

export interface NavbarGroup {
  label?: string
  icon?: string
  modules: ModuleKey[]
}

export type RoleFeatureKey =
  | 'view_all_schedules'
  | 'view_all_clients'
  | 'manage_packages'
  | 'reschedule'
  | 'view_financials'

export const ROLE_FEATURE_DEFINITIONS: { key: RoleFeatureKey; label: string; description: string }[] = [
  {
    key: 'view_all_schedules',
    label: 'Ver agenda de todos os profissionais',
    description: 'Permite ver a agenda completa da clínica.',
  },
  {
    key: 'view_all_clients',
    label: 'Ver lista completa de pacientes',
    description: 'Permite ver pacientes que nunca atendeu.',
  },
  {
    key: 'manage_packages',
    label: 'Gerenciar pacotes/assinaturas',
    description: 'Permite vender e gerenciar pacotes.',
  },
  {
    key: 'reschedule',
    label: 'Remarcar agendamentos',
    description: 'Permite remarcar consultas.',
  },
  {
    key: 'view_financials',
    label: 'Ver valores financeiros',
    description: 'Permite ver o valor dos atendimentos.',
  },
]

export interface RolePermissions {
  can_view: string[]
  can_edit: string[]
  features: RoleFeatureKey[]
}

// Global company features (non-role specific). Currently empty as previous features moved to Roles.
export interface CompanyFeatures {
  [key: string]: any
}

export interface CompanyConfig {
  id: string
  name: string
  slug: string
  is_active: boolean
  cnpj?: string
  subtitle?: string
  branding: CompanyBranding
  navbar_config?: NavbarGroup[]
  modules: Record<ModuleKey, ModuleConfig>
  roles: Record<string, RolePermissions>
  features?: Partial<CompanyFeatures>
}

export interface UserDoc {
  uid: string
  name: string
  email: string
  role: string
  companyId: string
  created_at: string
}

export const DEFAULT_BRANDING: CompanyBranding = {
  logo_url: '',
  app_name: 'Sistema',
  primary_hex: '#314E39',
  secondary_hex: '#6C976A',
  accent_hex: '#C49761',
  background_hex: '#FDFDFB',
  foreground_hex: '#1e2e20',
}

export const DEFAULT_FEATURES: CompanyFeatures = {}

export const DEFAULT_MODULES: Record<ModuleKey, ModuleConfig> = {
  overview: { enabled: true, label: 'Visão Geral' },
  appointments: { enabled: true, label: 'Agenda' },
  kpi: { enabled: true, label: 'Indicadores' },
  financial: { enabled: true, label: 'Gestão Financeira' },
  professionals: { enabled: true, label: 'Profissionais' },
  clients: { enabled: true, label: 'Pacientes' },
  time_tracking: { enabled: true, label: 'Ponto Eletrônico' },
  notifications: { enabled: true, label: 'Confirmações' },
  services: { enabled: true, label: 'Serviços e Pacotes' },
  partnerships: { enabled: true, label: 'Parcerias' },
  maintenance: { enabled: false, label: 'Manutenção' },
  gallery: { enabled: true, label: 'Galeria Clínica' },
}

export const DEFAULT_ROLES: Record<string, RolePermissions> = {
  admin: { can_view: ['*'], can_edit: ['*'], features: ['view_all_schedules', 'view_all_clients', 'manage_packages', 'reschedule', 'view_financials'] },
  professional: { can_view: ['clients', 'appointments', 'time_tracking', 'notifications'], can_edit: ['appointments', 'time_tracking'], features: [] },
  client: { can_view: ['dashboard'], can_edit: [], features: [] },
}

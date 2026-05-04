export type ModuleKey =
  | 'overview'
  | 'agenda'
  | 'kpi'
  | 'financials'
  | 'professionals'
  | 'patients'
  | 'timesheets'
  | 'messages'
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

export interface RolePermissions {
  can_view: string[]
  can_edit: string[]
}

export interface CompanyFeatures {
  professionals_view_all_schedules: boolean
  professionals_view_all_clients: boolean
}

export interface CompanyConfig {
  id: string
  name: string
  slug: string
  is_active: boolean
  branding: CompanyBranding
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

export const DEFAULT_FEATURES: CompanyFeatures = {
  professionals_view_all_schedules: false,
  professionals_view_all_clients: false,
}

export const DEFAULT_MODULES: Record<ModuleKey, ModuleConfig> = {
  overview:      { enabled: true,  label: 'Visão Geral' },
  agenda:        { enabled: true,  label: 'Agenda' },
  kpi:           { enabled: true,  label: 'Indicadores' },
  financials:    { enabled: true,  label: 'Gestão Financeira' },
  professionals: { enabled: true,  label: 'Profissionais' },
  patients:      { enabled: true,  label: 'Pacientes' },
  timesheets:    { enabled: true,  label: 'Ponto Eletrônico' },
  messages:      { enabled: true,  label: 'Confirmações' },
  services:      { enabled: true,  label: 'Serviços e Pacotes' },
  partnerships:  { enabled: true,  label: 'Parcerias' },
  maintenance:   { enabled: false, label: 'Manutenção' },
  gallery:       { enabled: true,  label: 'Galeria Clínica' },
}

export const DEFAULT_ROLES: Record<string, RolePermissions> = {
  admin:        { can_view: ['*'], can_edit: ['*'] },
  professional: { can_view: ['patients', 'agenda', 'timesheets'], can_edit: ['agenda', 'timesheets'] },
  client:       { can_view: ['dashboard'], can_edit: [] },
}

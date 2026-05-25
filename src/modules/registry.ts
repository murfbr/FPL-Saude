import type { ModuleKey } from '@/shared/types/tenant'

export interface ModuleRegistryEntry {
  key: ModuleKey
  label: string
  defaultEnabled: boolean
}

/**
 * Canonical list of all modules in the application.
 * - Developers add one entry here when creating a new module.
 * - The super-admin panel reads this array to build the Módulos tab — no terminal needed.
 * - DEFAULT_MODULES in tenant.ts is derived from this registry.
 * - Phase 4: AdminDashboard reads the company's Firestore config (built from these defaults)
 *   to decide which tabs to show.
 */
export const MODULE_REGISTRY: ModuleRegistryEntry[] = [
  { key: 'overview',      label: 'Visão Geral',       defaultEnabled: true  },
  { key: 'appointments',  label: 'Agenda',             defaultEnabled: true  },
  { key: 'kpi',           label: 'Indicadores',        defaultEnabled: true  },
  { key: 'financial',     label: 'Gestão Financeira',  defaultEnabled: true  },
  { key: 'professionals', label: 'Profissionais',      defaultEnabled: true  },
  { key: 'clients',       label: 'Pacientes',          defaultEnabled: true  },
  { key: 'time_tracking', label: 'Ponto Eletrônico',   defaultEnabled: true  },
  { key: 'notifications', label: 'Confirmações',       defaultEnabled: true  },
  { key: 'services',      label: 'Serviços e Pacotes', defaultEnabled: true  },
  { key: 'partnerships',  label: 'Parcerias',          defaultEnabled: true  },
  { key: 'maintenance',   label: 'Manutenção',         defaultEnabled: false },
  { key: 'gallery',       label: 'Galeria Clínica',    defaultEnabled: true  },
]

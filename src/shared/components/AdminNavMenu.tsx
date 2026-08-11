import React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  LayoutDashboard,
  BarChart,
  CreditCard,
  Users,
  Briefcase,
  Handshake,
  Stethoscope,
  Clock,
  MessageSquare,
  ChevronDown,
  Database,
  Camera,
  FolderTree
} from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { useTenant } from '@/shared/contexts/TenantContext'
import { MODULE_REGISTRY, isModuleEnabled } from '@/modules/registry'
import type { ModuleKey, NavbarGroup } from '@/shared/types/tenant'

interface AdminNavMenuProps {
  currentTab: string
  onTabChange: (value: string) => void
}

// Chaves canônicas do registry — o valor navegado é o mesmo ModuleKey das abas
const ICON_MAP: Record<string, React.ElementType> = {
  overview: BarChart,
  kpi: LayoutDashboard,
  appointments: Calendar,
  financial: CreditCard,
  clients: Users,
  professionals: Briefcase,
  partnerships: Handshake,
  services: Stethoscope,
  time_tracking: Clock,
  notifications: MessageSquare,
  gallery: Camera,
  maintenance: Database,
  default: FolderTree
}

const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  MODULE_REGISTRY.map((m) => [m.key, m.label]),
)

const DEFAULT_NAVBAR: NavbarGroup[] = [
  {
    modules: ['appointments']
  },
  {
    label: 'Gestão',
    modules: ['overview', 'kpi', 'financial', 'gallery']
  },
  {
    label: 'Cadastros',
    modules: ['clients', 'professionals', 'partnerships']
  },
  {
    label: 'Administrativo',
    modules: ['services', 'time_tracking', 'notifications', 'maintenance']
  }
]

export function AdminNavMenu({ currentTab, onTabChange }: AdminNavMenuProps) {
  const { config } = useTenant()

  const isEnabled = (key: string) => isModuleEnabled(config?.modules, key as ModuleKey)

  // Fallback to default if no navbar_config exists
  const navbarConfig = config?.navbar_config && config.navbar_config.length > 0 
    ? config.navbar_config 
    : DEFAULT_NAVBAR

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {navbarConfig.map((group, index) => {
        // Filter modules that are enabled for this company
        const enabledModules = group.modules.filter(m => isEnabled(m))
        
        if (enabledModules.length === 0) return null

        // If it has no label, render them as root buttons
        if (!group.label) {
          return enabledModules.map(moduleKey => {
            const Icon = ICON_MAP[moduleKey] || ICON_MAP.default
            const label = MODULE_LABELS[moduleKey] || moduleKey

            return (
              <Button
                key={moduleKey}
                variant={currentTab === moduleKey ? 'secondary' : 'ghost'}
                className={cn(currentTab === moduleKey && 'bg-accent')}
                onClick={() => onTabChange(moduleKey)}
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
              </Button>
            )
          })
        }

        // Render as Dropdown
        const isGroupActive = enabledModules.includes(currentTab as any)
        const GroupIcon = group.icon && ICON_MAP[group.icon] ? ICON_MAP[group.icon] : null

        return (
          <DropdownMenu key={index}>
            <DropdownMenuTrigger asChild>
              <Button
                variant={isGroupActive ? 'secondary' : 'ghost'}
                className={cn(isGroupActive && 'bg-accent')}
              >
                {GroupIcon && <GroupIcon className="w-4 h-4 mr-2" />}
                {group.label}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              {enabledModules.map(moduleKey => {
                const Icon = ICON_MAP[moduleKey] || ICON_MAP.default
                const label = MODULE_LABELS[moduleKey] || moduleKey
                return (
                  <DropdownMenuItem
                    key={moduleKey}
                    onClick={() => onTabChange(moduleKey)}
                    className={cn('cursor-pointer', currentTab === moduleKey && 'bg-muted')}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
    </div>
  )
}

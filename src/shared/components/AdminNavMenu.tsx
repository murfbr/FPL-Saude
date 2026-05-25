import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  CalendarDays as CalendarIcon,
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
} from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { useTenant } from '@/shared/contexts/TenantContext'

interface AdminNavMenuProps {
  currentTab: string
  onTabChange: (value: string) => void
}

export function AdminNavMenu({ currentTab, onTabChange }: AdminNavMenuProps) {
  const { config } = useTenant()

  const isEnabled = (key: string) =>
    config?.modules ? config.modules[key as keyof typeof config.modules]?.enabled !== false : true

  const gestaoTabs = ['overview', 'kpi', 'financials', 'gallery'].filter(isEnabled)
  const cadastrosTabs = ['patients', 'professionals', 'partnerships'].filter(isEnabled)
  const administrativoTabs = ['services', 'time_tracking', 'messages', 'maintenance'].filter(isEnabled)

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Agenda - Direct Link */}
      {isEnabled('agenda') && (
        <Button
          variant={currentTab === 'agenda' ? 'secondary' : 'ghost'}
          className={cn(currentTab === 'agenda' && 'bg-accent')}
          onClick={() => onTabChange('agenda')}
        >
          <Calendar className="w-4 h-4 mr-2" />
          Agenda
        </Button>
      )}

      {/* Gestão Dropdown */}
      {gestaoTabs.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={gestaoTabs.includes(currentTab) ? 'secondary' : 'ghost'}
              className={cn(gestaoTabs.includes(currentTab) && 'bg-accent')}
            >
              Gestão
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            {isEnabled('overview') && (
              <DropdownMenuItem
                onClick={() => onTabChange('overview')}
                className={cn('cursor-pointer', currentTab === 'overview' && 'bg-muted')}
              >
                <BarChart className="mr-2 h-4 w-4" />
                Visão Geral
              </DropdownMenuItem>
            )}
            {isEnabled('gallery') && (
              <DropdownMenuItem
                onClick={() => onTabChange('gallery')}
                className={cn('cursor-pointer', currentTab === 'gallery' && 'bg-muted')}
              >
                <Camera className="mr-2 h-4 w-4" />
                Galeria Clínica
              </DropdownMenuItem>
            )}
            {isEnabled('kpi') && (
              <DropdownMenuItem
                onClick={() => onTabChange('kpi')}
                className={cn('cursor-pointer', currentTab === 'kpi' && 'bg-muted')}
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Indicadores
              </DropdownMenuItem>
            )}
            {isEnabled('financials') && (
              <DropdownMenuItem
                onClick={() => onTabChange('financials')}
                className={cn('cursor-pointer', currentTab === 'financials' && 'bg-muted')}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Gestão Financeira
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Cadastros Dropdown */}
      {cadastrosTabs.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={cadastrosTabs.includes(currentTab) ? 'secondary' : 'ghost'}
              className={cn(cadastrosTabs.includes(currentTab) && 'bg-accent')}
            >
              Cadastros
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            {isEnabled('patients') && (
              <DropdownMenuItem
                onClick={() => onTabChange('patients')}
                className={cn('cursor-pointer', currentTab === 'patients' && 'bg-muted')}
              >
                <Users className="mr-2 h-4 w-4" />
                Pacientes
              </DropdownMenuItem>
            )}
            {isEnabled('professionals') && (
              <DropdownMenuItem
                onClick={() => onTabChange('professionals')}
                className={cn('cursor-pointer', currentTab === 'professionals' && 'bg-muted')}
              >
                <Briefcase className="mr-2 h-4 w-4" />
                Profissionais
              </DropdownMenuItem>
            )}
            {isEnabled('partnerships') && (
              <DropdownMenuItem
                onClick={() => onTabChange('partnerships')}
                className={cn('cursor-pointer', currentTab === 'partnerships' && 'bg-muted')}
              >
                <Handshake className="mr-2 h-4 w-4" />
                Parcerias
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Administrativo Dropdown */}
      {administrativoTabs.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={administrativoTabs.includes(currentTab) ? 'secondary' : 'ghost'}
              className={cn(administrativoTabs.includes(currentTab) && 'bg-accent')}
            >
              Administrativo
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            {isEnabled('services') && (
              <DropdownMenuItem
                onClick={() => onTabChange('services')}
                className={cn('cursor-pointer', currentTab === 'services' && 'bg-muted')}
              >
                <Stethoscope className="mr-2 h-4 w-4" />
                Serviços e Pacotes
              </DropdownMenuItem>
            )}
            {isEnabled('time_tracking') && (
              <DropdownMenuItem
                onClick={() => onTabChange('time_tracking')}
                className={cn('cursor-pointer', currentTab === 'time_tracking' && 'bg-muted')}
              >
                <Clock className="mr-2 h-4 w-4" />
                Ponto Eletrônico
              </DropdownMenuItem>
            )}
            {isEnabled('messages') && (
              <DropdownMenuItem
                onClick={() => onTabChange('messages')}
                className={cn('cursor-pointer', currentTab === 'messages' && 'bg-muted')}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Confirmações
              </DropdownMenuItem>
            )}
            {isEnabled('maintenance') && (
              <DropdownMenuItem
                onClick={() => onTabChange('maintenance')}
                className={cn('cursor-pointer', currentTab === 'maintenance' && 'bg-muted')}
              >
                <Database className="mr-2 h-4 w-4" />
                Manutenção de Dados
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

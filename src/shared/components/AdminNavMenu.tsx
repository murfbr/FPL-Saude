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
} from 'lucide-react'

import { cn } from '@/shared/lib/utils'

interface AdminNavMenuProps {
  currentTab: string
  onTabChange: (value: string) => void
}

export function AdminNavMenu({ currentTab, onTabChange }: AdminNavMenuProps) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Agenda Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={['agenda', 'blocked_dates'].includes(currentTab) ? 'secondary' : 'ghost'}
            className={cn(['agenda', 'blocked_dates'].includes(currentTab) && 'bg-accent')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Agenda
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          <DropdownMenuItem
            onClick={() => onTabChange('agenda')}
            className={cn('cursor-pointer', currentTab === 'agenda' && 'bg-muted')}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Ver Agenda
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onTabChange('blocked_dates')}
            className={cn('cursor-pointer', currentTab === 'blocked_dates' && 'bg-muted')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            Bloqueio de Datas
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Gestão Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={
              ['overview', 'kpi', 'financials'].includes(currentTab)
                ? 'secondary'
                : 'ghost'
            }
            className={cn(
              ['overview', 'kpi', 'financials'].includes(currentTab) &&
                'bg-accent',
            )}
          >
            Gestão
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          <DropdownMenuItem
            onClick={() => onTabChange('overview')}
            className={cn(
              'cursor-pointer',
              currentTab === 'overview' && 'bg-muted',
            )}
          >
            <BarChart className="mr-2 h-4 w-4" />
            Visão Geral
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onTabChange('kpi')}
            className={cn('cursor-pointer', currentTab === 'kpi' && 'bg-muted')}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Indicadores
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onTabChange('financials')}
            className={cn(
              'cursor-pointer',
              currentTab === 'financials' && 'bg-muted',
            )}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Gestão Financeira
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Cadastros Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={
              ['patients', 'professionals', 'partnerships'].includes(currentTab)
                ? 'secondary'
                : 'ghost'
            }
            className={cn(
              ['patients', 'professionals', 'partnerships'].includes(
                currentTab,
              ) && 'bg-accent',
            )}
          >
            Cadastros
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          <DropdownMenuItem
            onClick={() => onTabChange('patients')}
            className={cn(
              'cursor-pointer',
              currentTab === 'patients' && 'bg-muted',
            )}
          >
            <Users className="mr-2 h-4 w-4" />
            Pacientes
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onTabChange('professionals')}
            className={cn(
              'cursor-pointer',
              currentTab === 'professionals' && 'bg-muted',
            )}
          >
            <Briefcase className="mr-2 h-4 w-4" />
            Profissionais
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onTabChange('partnerships')}
            className={cn(
              'cursor-pointer',
              currentTab === 'partnerships' && 'bg-muted',
            )}
          >
            <Handshake className="mr-2 h-4 w-4" />
            Parcerias
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Administrativo Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={
              ['services', 'timesheets', 'messages'].includes(currentTab)
                ? 'secondary'
                : 'ghost'
            }
            className={cn(
              ['services', 'timesheets', 'messages'].includes(currentTab) &&
                'bg-accent',
            )}

          >
            Administrativo
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          <DropdownMenuItem
            onClick={() => onTabChange('services')}
            className={cn(
              'cursor-pointer',
              currentTab === 'services' && 'bg-muted',
            )}
          >
            <Stethoscope className="mr-2 h-4 w-4" />
            Serviços e Pacotes
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onTabChange('timesheets')}
            className={cn(
              'cursor-pointer',
              currentTab === 'timesheets' && 'bg-muted',
            )}
          >
            <Clock className="mr-2 h-4 w-4" />
            Ponto Eletrônico
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onTabChange('messages')}
            className={cn(
              'cursor-pointer',
              currentTab === 'messages' && 'bg-muted',
            )}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Confirmações
          </DropdownMenuItem>

        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

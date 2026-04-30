import { useState, useEffect } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Calendar, RefreshCw, Columns, Rows, Maximize2, Minimize2, PartyPopper, Plus } from 'lucide-react'
import { AgendaCalendarView } from './AgendaCalendarView'
import { AgendaWeekView } from './AgendaWeekView'
import { AgendaDayView } from './AgendaDayView'
import { Button } from '@/components/ui/button'
import { AppointmentFormDialog } from './AppointmentFormDialog'
import { EventFormDialog } from './EventFormDialog'
import { Appointment, Professional } from '@/shared/types'
import { AppointmentDetailDialog } from './AppointmentDetailDialog'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getAllProfessionals } from '@/shared/services'
import { GlobalBlockedDatesManager } from '@/modules/availability/components/GlobalBlockedDatesManager'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CalendarOff } from 'lucide-react'
import { useAuth } from '@/shared/providers/AuthProvider'
import { useInvalidateAppointments } from '@/modules/appointments/queries'

export type ViewMode = 'month' | 'week' | 'day'

export const AgendaView = () => {
  const { loading, companyId } = useAuth()
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isEventFormOpen, setIsEventFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isBlockedDatesOpen, setIsBlockedDatesOpen] = useState(false)
  const invalidateAppointments = useInvalidateAppointments()

  // Lifted State
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedProfessional, setSelectedProfessional] = useState('all')
  const [professionals, setProfessionals] = useState<Professional[]>([])

  // Quick Create State
  const [quickCreateDate, setQuickCreateDate] = useState<Date | undefined>(
    undefined,
  )
  const [isSpecificTimeSlot, setIsSpecificTimeSlot] = useState(false)

  const isMobile = useIsMobile()

  useEffect(() => {
    if (!loading && companyId) {
      getAllProfessionals().then(({ data }) => {
        setProfessionals(data || [])
      })
    }
  }, [loading, companyId])

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setIsDetailOpen(true)
  }

  const handleDataRefresh = (shouldInvalidate: boolean = true) => {
    if (shouldInvalidate) {
      setRefreshKey((prevKey) => prevKey + 1)
      invalidateAppointments()
    }
  }

  const handleTimeSlotClick = (date: Date, isSpecificSlot: boolean = true) => {
    setQuickCreateDate(date)
    setIsSpecificTimeSlot(isSpecificSlot)
    setIsFormOpen(true)
  }

  const handleFormClose = (open: boolean) => {
    setIsFormOpen(open)
    if (!open) {
      setQuickCreateDate(undefined)
      setIsSpecificTimeSlot(false)
    }
  }

  const commonProps = {
    currentDate,
    onDateChange: setCurrentDate,
    onViewChange: setViewMode,
    onAppointmentClick: handleAppointmentClick,
    onTimeSlotClick: handleTimeSlotClick,
    selectedProfessional,
    isExpanded,
  }

  const renderView = () => {
    switch (viewMode) {
      case 'month':
        return <AgendaCalendarView refreshTrigger={refreshKey} {...commonProps} />
      case 'week':
        return <AgendaWeekView refreshTrigger={refreshKey} {...commonProps} />
      case 'day':
        return <AgendaDayView refreshTrigger={refreshKey} {...commonProps} />
      default:
        return <AgendaDayView refreshTrigger={refreshKey} {...commonProps} />
    }
  }

  const renderViewSwitcher = () => {
    if (isMobile) {
      return (
        <Select
          value={viewMode}
          onValueChange={(value: ViewMode) => value && setViewMode(value)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Visualização" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mês</SelectItem>
            <SelectItem value="week">Semana</SelectItem>
            <SelectItem value="day">Dia</SelectItem>
          </SelectContent>
        </Select>
      )
    }
    return (
      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(value: ViewMode) => value && setViewMode(value)}
        className="border rounded-md p-1 h-9"
      >
        <ToggleGroupItem
          value="month"
          aria-label="Month view"
          className="h-7 w-7 p-0"
        >
          <Calendar className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="week"
          aria-label="Week view"
          className="h-7 w-7 p-0"
        >
          <Columns className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="day"
          aria-label="Day view"
          className="h-7 w-7 p-0"
        >
          <Rows className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border shadow-sm">
      {/* Consolidated Single Row Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 border-b">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
          <h2 className="text-lg font-semibold whitespace-nowrap">Agenda</h2>

          <Select
            value={selectedProfessional}
            onValueChange={setSelectedProfessional}
          >
            <SelectTrigger className="w-full md:w-[240px]">
              <SelectValue placeholder="Selecione o profissional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Profissionais</SelectItem>
              {professionals.map((prof) => (
                <SelectItem key={prof.id} value={prof.id}>
                  {prof.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!isMobile && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBlockedDatesOpen(true)}
              className="text-muted-foreground whitespace-nowrap"
            >
              <CalendarOff className="h-4 w-4 mr-2" />
              Bloquear Datas
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <Button
            variant="outline"
            size={isMobile ? "sm" : "default"}
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-muted-foreground whitespace-nowrap"
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4 sm:mr-2" />
            ) : (
              <Maximize2 className="h-4 w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">
              {isExpanded ? 'Recolher' : 'Expandir'}
            </span>
          </Button>

          <Button
            size={isMobile ? "sm" : "default"}
            onClick={() => setIsEventFormOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white whitespace-nowrap"
          >
            <PartyPopper className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Novo Evento</span>
          </Button>

          {isMobile && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBlockedDatesOpen(true)}
              className="text-muted-foreground p-2"
            >
              <CalendarOff className="h-4 w-4" />
            </Button>
          )}
          {renderViewSwitcher()}
        </div>
      </div>

      <div className="flex-1 min-h-0">{renderView()}</div>

      <AppointmentFormDialog
        isOpen={isFormOpen}
        onOpenChange={handleFormClose}
        onAppointmentCreated={handleDataRefresh}
        initialDate={quickCreateDate}
        isSpecificTimeSlot={isSpecificTimeSlot}
        preselectedProfessionalId={
          selectedProfessional !== 'all' ? selectedProfessional : undefined
        }
      />
      <EventFormDialog
        isOpen={isEventFormOpen}
        onOpenChange={setIsEventFormOpen}
        onEventCreated={handleDataRefresh}
        initialDate={quickCreateDate}
        preselectedProfessionalId={
          selectedProfessional !== 'all' ? selectedProfessional : undefined
        }
      />
      <AppointmentDetailDialog
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        appointment={selectedAppointment}
        onAppointmentUpdated={handleDataRefresh}
      />
      <Dialog open={isBlockedDatesOpen} onOpenChange={setIsBlockedDatesOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestão de Bloqueio de Datas</DialogTitle>
            <DialogDescription className="sr-only">
              Configure feriados, folgas ou períodos de manutenção para bloquear novos agendamentos em toda a clínica.
            </DialogDescription>
          </DialogHeader>
          <GlobalBlockedDatesManager />
        </DialogContent>
      </Dialog>
    </div>
  )
}

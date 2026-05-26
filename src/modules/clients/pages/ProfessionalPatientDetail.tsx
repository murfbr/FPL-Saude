import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getClientById, getAppointmentsByClientId, getAppointmentsByClientIdPaginated, getClientExams, uploadClientExam, deleteClientExam, getClientNotesWithFallback } from '@/shared/services'
import { Client, Appointment, NoteEntry, ClientExam } from '@/shared/types'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  CreditCard,
  Phone,
  StickyNote,
  Plus,
  File,
  Download,
  X,
  Trash2,
  Loader2,
  Repeat,
  History,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { format, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DateRange } from 'react-day-picker'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Badge } from '@/components/ui/badge'
import { ProfessionalAppointmentDialog } from '@/modules/appointments/components/ProfessionalAppointmentDialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatCPF } from '@/shared/lib/utils'
import { GeneralAssessmentForm } from '@/modules/clients/components/GeneralAssessmentForm'
import { ClientPackagesList } from '@/modules/packages/components/ClientPackagesList'
import { useAuth } from '@/shared/providers/AuthProvider'
import { useTenant } from '@/shared/contexts/TenantContext'
import { useToast } from '@/shared/hooks/use-toast'
import { ClientGallery } from '@/modules/gallery/components/ClientGallery'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ProfessionalPatientDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [patient, setPatient] = useState<Client | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { toast } = useToast()
  const { user, professionalId, role } = useAuth()
  const { config } = useTenant()
  const [localNotes, setLocalNotes] = useState<NoteEntry[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [lastVisibleDoc, setLastVisibleDoc] = useState<any>(null)
  const [hasMoreAppointments, setHasMoreAppointments] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true)

  // Prontuário — notas com fallback robusto (subcoleção + legado)
  const [clientNotes, setClientNotes] = useState<NoteEntry[]>([])
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)
  const [notesPage, setNotesPage] = useState(1)
  const [notesTotalCount, setNotesTotalCount] = useState(0)
  const PAGE_SIZE_NOTES = 10

  const handleBack = () => {
    if (location.key === 'default') {
      navigate('/profissional?tab=clients')
    } else {
      navigate(-1)
    }
  }

  const loadClientNotes = async (page: number) => {
    if (!id) return
    setIsLoadingNotes(true)
    const { data, totalCount } = await getClientNotesWithFallback(id, page, PAGE_SIZE_NOTES)
    if (data) {
      setClientNotes(data)
      setNotesPage(page)
      setNotesTotalCount(totalCount)
    }
    setIsLoadingNotes(false)
  }

  const fetchData = async () => {
    if (!id) return
    setIsLoading(true)
    const [patientRes] = await Promise.all([
      getClientById(id),
    ])
    setPatient(patientRes.data)
    setIsLoading(false)
  }

  const fetchAppointments = async () => {
    if (!id) return
    setIsLoadingAppointments(true)
    const { data, lastVisible, hasMore } = await getAppointmentsByClientIdPaginated(
      id,
      15,
      null,
      {
        status: statusFilter,
        startDate: dateRange?.from,
        endDate: dateRange?.to,
      }
    )
    if (data) {
      setAppointments(data)
      setLastVisibleDoc(lastVisible)
      setHasMoreAppointments(hasMore)
    } else {
      setAppointments([])
    }
    setIsLoadingAppointments(false)
  }

  const loadMoreAppointments = async () => {
    if (!id || isLoadingMore || !hasMoreAppointments) return
    setIsLoadingMore(true)
    
    const { data, lastVisible, hasMore } = await getAppointmentsByClientIdPaginated(
      id, 
      15, 
      lastVisibleDoc,
      {
        status: statusFilter,
        startDate: dateRange?.from,
        endDate: dateRange?.to,
      }
    )

    if (data) {
      setAppointments(prev => [...prev, ...data])
      setLastVisibleDoc(lastVisible)
      setHasMoreAppointments(hasMore)
    }
    setIsLoadingMore(false)
  }

  useEffect(() => {
    fetchData()
    loadClientNotes(1)
  }, [id])

  useEffect(() => {
    fetchAppointments()
  }, [id, statusFilter, dateRange])

  const handleEditNotes = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setIsDialogOpen(true)
  }

  const validAppointments = useMemo(() => {
    let filtered = appointments.filter(
      (appt) =>
        appt.schedules?.start_time &&
        isValid(new Date(appt.schedules.start_time)),
    )
    
    return filtered.sort((a, b) => 
      new Date(b.schedules.start_time).getTime() - new Date(a.schedules.start_time).getTime()
    )
  }, [appointments])

  const notesPagesTotal = Math.ceil(notesTotalCount / PAGE_SIZE_NOTES)

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-48 md:col-span-1" />
          <Skeleton className="h-96 md:col-span-2" />
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <h2 className="text-2xl font-bold">Paciente não encontrado</h2>
        <Button onClick={handleBack} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="container mx-auto py-8 px-4">
        <Button onClick={handleBack} variant="outline" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <Card>
              <CardHeader className="items-center text-center">
                <Avatar className="w-24 h-24 mb-4">
                  <AvatarImage
                    src={patient.profile_picture_url || ''}
                    alt={patient.name}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-2xl">
                    {getInitials(patient.name)}
                  </AvatarFallback>
                </Avatar>
                <CardTitle>{patient.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    CPF: {formatCPF(patient.email)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {patient.phone || 'Não informado'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <ClientPackagesList 
              clientId={patient.id} 
              readOnly={!config?.roles?.[role || 'professional']?.features?.includes('manage_packages')}
            />
          </div>
          <div className="md:col-span-2 space-y-6">
            <GeneralAssessmentForm 
              client={patient} 
              onClientUpdated={(updated) => setPatient(updated)}
            />

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      <StickyNote className="w-6 h-6" />
                      Histórico de Anotações
                    </CardTitle>
                    <CardDescription>
                      {notesTotalCount > 0
                        ? `${notesTotalCount} anotação${notesTotalCount !== 1 ? 'ões' : ''} no total`
                        : 'Histórico consolidado de todas as sessões.'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoadingNotes && clientNotes.length === 0 ? (
                  <div className="flex justify-center items-center h-[200px]">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : clientNotes.length > 0 ? (
                  <div className="space-y-3">
                    {clientNotes.map((note, index) => (
                      <div
                        key={note.id || index}
                        className="bg-muted/20 p-4 rounded-lg border shadow-sm"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-sm text-primary">
                            {note.professional_name || 'Profissional'}
                          </span>
                          <div className="text-xs text-muted-foreground text-right">
                            <p>
                              {format(new Date(note.date), "dd/MM/yyyy 'às' HH:mm", {
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">
                          {note.content}
                        </p>
                        {note.updated_at && (
                          <span className="text-[10px] text-muted-foreground italic mt-2 block">
                            Editado em {format(new Date(note.updated_at), 'dd/MM/yyyy HH:mm')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    Nenhuma anotação registrada para este paciente.
                  </p>
                )}

                {/* Paginação */}
                {notesPagesTotal > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      {(notesPage - 1) * PAGE_SIZE_NOTES + 1}–{Math.min(notesPage * PAGE_SIZE_NOTES, notesTotalCount)} de {notesTotalCount}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadClientNotes(notesPage - 1)}
                        disabled={notesPage === 1 || isLoadingNotes}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadClientNotes(notesPage + 1)}
                        disabled={notesPage >= notesPagesTotal || isLoadingNotes}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <ClientGallery clientId={patient.id} clientName={patient.name} />

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      <StickyNote className="w-6 h-6" />
                      Histórico de Agendamentos
                    </CardTitle>
                    <CardDescription>
                      Total de {validAppointments.length} agendamentos.
                    </CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <DateRangePicker 
                      date={dateRange} 
                      onDateChange={setDateRange} 
                      className="w-full sm:w-auto" 
                    />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[150px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="scheduled">Agendado</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                        <SelectItem value="no_show">Faltou</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingAppointments ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : validAppointments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum agendamento encontrado para este período.
                  </p>
                ) : (
                  <Accordion type="single" collapsible className="w-full">
                    {validAppointments.map((appt) => (
                    <AccordionItem value={appt.id} key={appt.id}>
                      <AccordionTrigger>
                        <div className="flex justify-between w-full pr-4">
                          <span>
                            {appt.services.name} com {appt.professionals.name}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {format(
                              new Date(appt.schedules.start_time),
                              'dd/MM/yyyy',
                              { locale: ptBR },
                            )}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="prose prose-sm max-w-none dark:prose-invert">
                        <div className="flex justify-between items-start">
                          <div>
                            <p>
                              <strong>Status:</strong>{' '}
                              <Badge>{appt.status}</Badge>
                            </p>
                            <p>
                              <strong>Anotações da Sessão:</strong>
                            </p>
                            <div className="p-2 border rounded-md bg-muted/50 min-h-[60px]">
                              {appt.notes && appt.notes.length > 0
                                ? appt.notes[appt.notes.length - 1].content
                                : 'Nenhuma anotação para esta sessão.'}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditNotes(appt)}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Detalhes
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                )}

                {hasMoreAppointments && (
                  <div className="mt-6 flex justify-center">
                    <Button 
                      variant="outline" 
                      onClick={loadMoreAppointments}
                      disabled={isLoadingMore}
                      className="gap-2"
                    >
                      {isLoadingMore ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Carregar Mais
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <ProfessionalAppointmentDialog
        appointment={selectedAppointment}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onUpdate={fetchData}
      />
    </>
  )
}

export default ProfessionalPatientDetail

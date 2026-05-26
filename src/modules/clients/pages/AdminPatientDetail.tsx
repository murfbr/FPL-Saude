import { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  getClientById,
  updateClient,
  deleteClient,
  exportClientData,
  getAppointmentsByClientId,
  getAppointmentsByClientIdPaginated,
  getClientExams,
  uploadClientExam,
  deleteClientExam,
  getClientNotesWithFallback,
} from '@/shared/services'
import { Client, Appointment, Partnership, NoteEntry, ClientExam } from '@/shared/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  CreditCard,
  Phone,
  FileText,
  Edit,
  Trash2,
  Handshake,
  StickyNote,
  CheckCircle2,
  Upload,
  Plus,
  File,
  Download,
  X,
  Loader2,
} from 'lucide-react'
import { format, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DateRange } from 'react-day-picker'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/shared/hooks/use-toast'
import { PatientEditDialog } from '@/modules/clients/components/PatientEditDialog'
import { getAllPartnerships } from '@/shared/services'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AppointmentDetailDialog } from '@/modules/appointments/components/AppointmentDetailDialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatCPF } from '@/shared/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { GeneralAssessmentForm } from '@/modules/clients/components/GeneralAssessmentForm'
import { ClientPackagesList } from '@/modules/packages/components/ClientPackagesList'
import { ClientSubscriptionsList } from '@/modules/subscriptions/components/ClientSubscriptionsList'
import { useAuth } from '@/shared/providers/AuthProvider'
import { ClientGallery } from '@/modules/gallery/components/ClientGallery'

const PatientDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { user, professionalId } = useAuth()
  const [patient, setPatient] = useState<Client | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [partnerships, setPartnerships] = useState<Partnership[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
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
  const [notesHasMore, setNotesHasMore] = useState(false)
  const PAGE_SIZE_NOTES = 10

  const [exams, setExams] = useState<ClientExam[]>([])
  const [isUploadingExam, setIsUploadingExam] = useState(false)
  const [isLoadingExams, setIsLoadingExams] = useState(false)
  const [isExamDialogOpen, setIsExamDialogOpen] = useState(false)
  const [newExamName, setNewExamName] = useState('')
  const [newExamType, setNewExamType] = useState<'exame' | 'laudo'>('exame')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleBack = () => {
    if (location.key === 'default') {
      navigate('/admin?tab=patients')
    } else {
      navigate(-1)
    }
  }

  const loadClientNotes = async (page: number) => {
    if (!id) return
    setIsLoadingNotes(true)
    const { data, totalCount, hasMore } = await getClientNotesWithFallback(id, page, PAGE_SIZE_NOTES)
    if (data) {
      setClientNotes(data)
      setNotesPage(page)
      setNotesTotalCount(totalCount)
      setNotesHasMore(hasMore)
    }
    setIsLoadingNotes(false)
  }

  const fetchPatientData = async () => {
    if (!id) return
    setIsLoading(true)
    const [patientRes, partnershipRes] = await Promise.all([
      getClientById(id),
      getAllPartnerships(),
    ])
    setPatient(patientRes.data)
    setPartnerships(partnershipRes.data || [])
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

  const fetchExams = async () => {
    if (!id) return
    setIsLoadingExams(true)
    const { data } = await getClientExams(id)
    if (data) setExams(data)
    setIsLoadingExams(false)
  }

  useEffect(() => {
    fetchPatientData()
    fetchExams()
    loadClientNotes(1)
  }, [id])

  useEffect(() => {
    fetchAppointments()
  }, [id, statusFilter, dateRange])

  const handleStatusChange = async (isActive: boolean) => {
    if (!patient) return
    const { data, error } = await updateClient(patient.id, {
      is_active: isActive,
    })
    if (error) {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' })
    } else if (data) {
      setPatient((prev) => (prev ? { ...prev, ...data } : data))
      toast({
        title: `Paciente ${isActive ? 'ativado' : 'inativado'} com sucesso!`,
      })
    }
  }

  const handleDelete = async () => {
    if (!patient) return
    const { error } = await deleteClient(patient.id)
    if (error) {
      toast({ title: 'Erro ao excluir paciente', variant: 'destructive' })
    } else {
      toast({ title: 'Paciente excluído com sucesso!' })
      navigate('/?tab=patients')
    }
  }

  const handlePartnershipChange = async (partnershipId: string) => {
    if (!patient) return
    const newPartnershipId = partnershipId === 'none' ? null : partnershipId

    const { data, error } = await updateClient(patient.id, {
      partnership_id: newPartnershipId,
    })

    if (error) {
      toast({ title: 'Erro ao atualizar parceria', variant: 'destructive' })
    } else if (data) {
      const selectedPartnership =
        partnerships.find((p) => p.id === newPartnershipId) || null
      setPatient({ ...patient, ...data, partnerships: selectedPartnership })
      toast({ title: 'Parceria atualizada com sucesso!' })
    }
  }

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setIsDetailDialogOpen(true)
  }

  const handleExport = async (format: 'pdf' | 'docx') => {
    if (!id) return
    setIsExporting(true)
    const { data, error } = await exportClientData(id, 'clinical_history', format)
    if (error) {
      toast({
        title: 'Erro ao exportar',
        description: error.message,
        variant: 'destructive',
      })
    } else if (data) {
      const linkSource = `data:application/${format === 'pdf' ? 'pdf' : 'vnd.openxmlformats-officedocument.wordprocessingml.document'};base64,${data.content}`
      const downloadLink = document.createElement('a')
      downloadLink.href = linkSource
      downloadLink.download = data.filename
      downloadLink.click()
    }
    setIsExporting(false)
  }

  const handleUploadExam = async () => {
    if (!id || !selectedFile || !newExamName.trim()) return
    setIsUploadingExam(true)

    const { data, error } = await uploadClientExam(
      id,
      {
        client_id: id,
        name: newExamName,
        type: newExamType,
        professional_id: professionalId || undefined,
        professional_name: user?.displayName || user?.email || 'Administrador'
      },
      selectedFile
    )

    if (error) {
       toast({ title: 'Erro ao enviar arquivo', description: error.message, variant: 'destructive' })
    } else {
       toast({ title: 'Arquivo enviado com sucesso!' })
       setIsExamDialogOpen(false)
       setNewExamName('')
       setSelectedFile(null)
       fetchExams()
    }
    setIsUploadingExam(false)
  }

  const handleDeleteExam = async (exam: ClientExam) => {
    // Moved to GeneralAssessmentForm
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
          <Skeleton className="h-64 md:col-span-1" />
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
          Voltar para Pacientes
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
                <Badge
                  variant={patient.is_active ? 'default' : 'destructive'}
                  className="w-fit mt-2"
                >
                  {patient.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
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
                <div className="flex items-center gap-3">
                  <Handshake className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {patient.partnerships?.name || 'Nenhuma parceria'}
                  </span>
                </div>
                <div className="pt-2">
                  <Label htmlFor="partnership-select">Alterar Parceria</Label>
                  <Select
                    value={patient.partnership_id || 'none'}
                    onValueChange={handlePartnershipChange}
                  >
                    <SelectTrigger id="partnership-select">
                      <SelectValue placeholder="Selecione uma parceria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {partnerships.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <div className="flex items-center space-x-2 w-full justify-between p-2 border rounded-md">
                  <Label htmlFor="status-switch">Status do Paciente</Label>
                  <Switch
                    id="status-switch"
                    checked={patient.is_active}
                    onCheckedChange={handleStatusChange}
                  />
                </div>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(true)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar Paciente
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" variant="destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir Paciente
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Tem certeza que deseja excluir?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso excluirá
                        permanentemente o paciente e todos os seus dados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>

            {/* Service Entitlements: Packages and Subscriptions */}
            <div className="space-y-4">
              <ClientSubscriptionsList clientId={patient.id} />
              <ClientPackagesList clientId={patient.id} />
            </div>
          </div>
          <div className="md:col-span-2 space-y-6">
            <GeneralAssessmentForm 
              client={patient} 
              onClientUpdated={(updated) => setPatient(updated)}
            />

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex flex-col space-y-1.5">
                  <CardTitle className="flex items-center gap-3">
                    <StickyNote className="w-6 h-6" />
                    Prontuário / Evolução
                  </CardTitle>
                  <CardDescription>
                    {notesTotalCount > 0
                      ? `${notesTotalCount} anotação${notesTotalCount !== 1 ? 'ões' : ''} no total`
                      : 'Histórico consolidado de todas as sessões.'}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => handleExport('pdf')}
                    >
                      Exportar como PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleExport('docx')}
                    >
                      Exportar como DOCX
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
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
                      <FileText className="w-6 h-6" />
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
                            onClick={() => handleAppointmentClick(appt)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
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
      <PatientEditDialog
        patient={patient}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onPatientUpdated={setPatient}
      />
      <AppointmentDetailDialog
        appointment={selectedAppointment}
        isOpen={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        onAppointmentUpdated={fetchPatientData}
      />
    </>
  )
}

export default PatientDetail

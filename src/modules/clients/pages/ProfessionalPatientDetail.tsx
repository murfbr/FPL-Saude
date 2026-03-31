import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getClientById, getAppointmentsByClientId, getClientExams, uploadClientExam, deleteClientExam } from '@/shared/services'
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
} from 'lucide-react'
import { format, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { ProfessionalAppointmentDialog } from '@/modules/appointments/components/ProfessionalAppointmentDialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatCPF } from '@/shared/lib/utils'
import { GeneralAssessmentForm } from '@/modules/clients/components/GeneralAssessmentForm'
import { ClientPackagesList } from '@/modules/packages/components/ClientPackagesList'
import { useAuth } from '@/shared/providers/AuthProvider'
import { useToast } from '@/shared/hooks/use-toast'
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
  const { user, professionalId } = useAuth()
  const [localNotes, setLocalNotes] = useState<NoteEntry[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const handleBack = () => {
    if (location.key === 'default') {
      navigate('/profissional?tab=clients')
    } else {
      navigate(-1)
    }
  }

  const fetchData = async () => {
    if (!id) return
    setIsLoading(true)
    const [patientRes, apptRes] = await Promise.all([
      getClientById(id),
      getAppointmentsByClientId(id),
    ])
    setPatient(patientRes.data)
    setAppointments(apptRes.data || [])
    setIsLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [id])

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
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(appt => appt.status === statusFilter)
    }
    
    return filtered.sort((a, b) => 
      new Date(b.schedules.start_time).getTime() - new Date(a.schedules.start_time).getTime()
    )
  }, [appointments, statusFilter])

  const consolidatedNotes = useMemo(() => {
    const allNotes: (NoteEntry & { appointmentId?: string })[] = []
    
    // Notas de agendamentos
    appointments.forEach((appt) => {
      if (appt.notes) {
        appt.notes.forEach((note) => {
          allNotes.push({ ...note, appointmentId: appt.id })
        })
      }
    })

    // Histórico importado da ficha de avaliação
    if (patient?.general_assessment && Array.isArray(patient.general_assessment)) {
      patient.general_assessment.forEach((entry: any) => {
        if (entry.type === 'imported_history') {
          allNotes.push({
            date: entry.date,
            content: entry.content,
            professional_name: 'Histórico Importado',
          })
        }
      })
    }

    return allNotes.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
  }, [appointments, patient?.general_assessment])

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

            <ClientPackagesList clientId={patient.id} />
          </div>
          <div className="md:col-span-2 space-y-6">
            <GeneralAssessmentForm 
              client={patient} 
              onClientUpdated={(updated) => setPatient(updated)}
            />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <StickyNote className="w-6 h-6" />
                  Histórico de Anotações
                </CardTitle>
                <CardDescription>
                  Histórico consolidado de todas as sessões.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-muted/20">
                  {consolidatedNotes.length > 0 ? (
                    <div className="space-y-4">
                      {consolidatedNotes.map((note, index) => (
                        <div
                          key={index}
                          className="bg-background p-4 rounded-lg border shadow-sm"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-sm text-primary">
                              {note.professional_name}
                            </span>
                            <div className="text-xs text-muted-foreground text-right">
                              <p>
                                {format(new Date(note.date), 'dd/MM/yyyy', {
                                  locale: ptBR,
                                })}
                              </p>
                              <p>
                                {format(new Date(note.date), 'HH:mm', {
                                  locale: ptBR,
                                })}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">
                            {note.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">
                      Nenhuma anotação registrada para este paciente.
                    </p>
                  )}
                </ScrollArea>
            </CardContent>
          </Card>

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
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
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
              </CardHeader>
              <CardContent>
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

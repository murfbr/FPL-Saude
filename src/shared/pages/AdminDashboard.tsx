import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Users,
  Calendar,
  Stethoscope,
  Briefcase,
  BarChart,
  LayoutDashboard,
  Handshake,
  PlusCircle,
  Search,
  CreditCard,
  Clock,
  MessageSquare,
  Camera,
} from 'lucide-react'

import { useAuth } from '@/shared/providers/AuthProvider'
import { Professional, Client, Service } from '@/shared/types'
import { useTenant } from '@/shared/contexts/TenantContext'
import { useProfessionalsQuery, useProfessionalDetailQuery, useProfessionalsCountQuery } from '@/modules/professionals/hooks/useProfessionals'
import { getAllClients, getClientsCount } from '@/modules/clients/service'
import { getAllServices } from '@/modules/services-catalog/service'
import { UpcomingAppointments } from '@/modules/appointments/components/UpcomingAppointmentsAdmin'
import { ProfessionalsList } from '@/modules/professionals/components/ProfessionalsList'
import { PatientsList } from '@/modules/clients/components/PatientsList'
import { ServicesManager } from '@/modules/services-catalog/components/ServicesManager'
import { AgendaView } from '@/modules/appointments/components/AgendaView'
import { KpiDashboard } from '@/modules/kpis/components/KpiDashboard'
import { PartnershipsManager } from '@/modules/partnerships/components/PartnershipsManager'
import { FinancialManagement } from '@/modules/financial/components/FinancialManagement'
import { TimeSheetReport } from '@/modules/time-tracking/components/TimeSheetReport'
import { MessageConfirmation } from '@/modules/messages/components/MessageConfirmation'
import { DataMaintenance } from '@/modules/maintenance/components/DataMaintenance'
import ClinicalGalleryAdmin from '@/modules/gallery/pages/ClinicalGalleryAdmin'
import { Button } from '@/components/ui/button'
import { Database } from 'lucide-react'

import { PatientFormDialog } from '@/modules/clients/components/PatientFormDialog'
import { ProfessionalFormDialog } from '@/modules/professionals/components/ProfessionalFormDialog'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { AdminNavMenu } from '@/shared/components/AdminNavMenu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BirthdaysList } from '@/modules/clients/components/BirthdaysList'
import { ClientOnboardingDialog } from '@/modules/clients/components/ClientOnboardingDialog'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type ClientStatusFilter = 'all' | 'active' | 'inactive'

const translateStatus = (status: ClientStatusFilter) => {
  switch (status) {
    case 'active': return 'ativos'
    case 'inactive': return 'inativos'
    case 'all': return 'todos'
    default: return status
  }
}

const AdminDashboard = () => {
  const { user, professionalId, role, loading, companyId } = useAuth()
  const { config, tenantLoading } = useTenant()
  const [searchParams, setSearchParams] = useSearchParams()
  const [clients, setClients] = useState<Client[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [clientsCount, setClientsCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isCountsLoading, setIsCountsLoading] = useState(true)

  // Query Hooks
  const { data: professionalDetail } = useProfessionalDetailQuery(professionalId || '')
  const { data: professionalsCountQuery, isLoading: isProfCountLoading } = useProfessionalsCountQuery({ status: 'active' })
  const professionalsCount = professionalsCountQuery ?? 0
  
  const { data: professionalsQuery, isLoading: isProfessionalsLoading } = useProfessionalsQuery()
  const professionals = professionalsQuery || []

  // Modal State Management - Explicit initialization to false
  const [isPatientFormOpen, setIsPatientFormOpen] = useState(false)
  const [isProfessionalFormOpen, setIsProfessionalFormOpen] = useState(false)
  const [isOnboardingDialogOpen, setIsOnboardingDialogOpen] = useState(false)

  const [clientStatusFilter, setClientStatusFilter] =
    useState<ClientStatusFilter>('active')
  const [clientServiceFilter, setClientServiceFilter] = useState<string>('all')
  const [clientSearch, setClientSearch] = useState('')
  const [newlyCreatedClient, setNewlyCreatedClient] = useState<Client | null>(
    null,
  )
  const [userName, setUserName] = useState<string>('')
  const isMobile = useIsMobile()

  const currentTab = searchParams.get('tab') || 'overview'

  // AUTOMATED OVERLAY CLEANUP
  useEffect(() => {
    const cleanupGhostOverlays = () => {
      document.body.style.pointerEvents = ''
      document.body.style.overflow = ''
    }
    cleanupGhostOverlays()
    return () => {
      cleanupGhostOverlays()
    }
  }, [])

  // Module enforcement
  useEffect(() => {
    if (config?.modules && currentTab) {
      if (config.modules[currentTab as keyof typeof config.modules]?.enabled === false) {
        const firstEnabled = [
          'overview', 'kpi', 'agenda', 'financials', 'professionals', 'patients', 
          'timesheets', 'messages', 'services', 'gallery', 'partnerships', 'maintenance'
        ].find(t => config.modules[t as keyof typeof config.modules]?.enabled !== false)
        if (firstEnabled) {
          setSearchParams({ tab: firstEnabled })
        }
      }
    }
  }, [config, currentTab, setSearchParams])

  useEffect(() => {
    if (professionalDetail) {
      setUserName(professionalDetail.name)
      return
    }
    if (user?.displayName) {
      setUserName(user.displayName)
    } else {
      setUserName('Administrador')
    }
  }, [professionalDetail, user])

  // Fetch Services for Filter
  useEffect(() => {
    const fetchServices = async () => {
      if (loading || !user || (!companyId && role !== 'super_admin')) return
      const { data } = await getAllServices()
      if (data) setServices(data)
    }
    fetchServices()
  }, [loading, user, companyId, role])

  useEffect(() => {
    const fetchCounts = async () => {
      if (loading || !user || (!companyId && role !== 'super_admin')) return
      setIsCountsLoading(true)
      const [clientRes] = await Promise.all([
        getClientsCount({ status: clientStatusFilter === 'all' ? undefined : clientStatusFilter }),
      ])
      if (clientRes.count !== undefined) setClientsCount(clientRes.count)
      setIsCountsLoading(false)
    }
    fetchCounts()
  }, [clientStatusFilter, loading, user, companyId, role])

  const fetchLists = async () => {
    setIsLoading(true)
    if (currentTab === 'patients') {
      const clientRes = await getAllClients({
        status: clientStatusFilter,
        serviceId: clientServiceFilter,
      })
      if (clientRes.data) setClients(clientRes.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (!loading && user && (companyId || role === 'super_admin')) {
      if (currentTab === 'professionals' || currentTab === 'patients') {
        fetchLists()
      }
    }
  }, [currentTab, clientStatusFilter, clientServiceFilter, loading, user, companyId, role])

  const handlePatientCreated = (client: Client) => {
    if (currentTab === 'patients') fetchLists()
    setNewlyCreatedClient(client)
    setIsOnboardingDialogOpen(true)
  }

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value })
  }

  const filteredClients = clients.filter((client) => {
    const search = clientSearch.toLowerCase()
    return (
      client.name.toLowerCase().includes(search) ||
      client.email.toLowerCase().includes(search) ||
      (client.phone && client.phone.toLowerCase().includes(search))
    )
  })

  const tabOptions = [
    { value: 'overview', label: 'Visão Geral', icon: BarChart },
    { value: 'kpi', label: 'Indicadores', icon: LayoutDashboard },
    { value: 'agenda', label: 'Agenda', icon: Calendar },
    { value: 'financials', label: 'Gestão Financeira', icon: CreditCard },
    { value: 'professionals', label: 'Profissionais', icon: Briefcase },
    { value: 'patients', label: 'Pacientes', icon: Users },
    { value: 'timesheets', label: 'Ponto Eletrônico', icon: Clock },
    { value: 'messages', label: 'Confirmações', icon: MessageSquare },
    { value: 'services', label: 'Serviços e Pacotes', icon: Stethoscope },
    { value: 'gallery', label: 'Galeria Clínica', icon: Camera },
    { value: 'partnerships', label: 'Parcerias', icon: Handshake },
    { value: 'maintenance', label: 'Manutenção', icon: Database },
  ].filter(tab => config?.modules ? config.modules[tab.value as keyof typeof config.modules]?.enabled !== false : true)

  // Role-Based Rendering Check: Wait for profile to be fully loaded
  if (loading || tenantLoading || !role || (!companyId && role !== 'super_admin')) {
    return (
      <div className="container mx-auto py-8 px-4 space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    )
  }

  return (
    <>
      <div className="container mx-auto py-4 px-4 print:p-0 print:max-w-none print:w-full">
        <div className="mb-6 print:hidden">
          <h1 className="text-xl md:text-2xl font-bold font-sans tracking-tight">
            Bem-vindo, {userName}.
          </h1>
        </div>

        <Tabs
          value={currentTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          {isMobile ? (
            <div className="mb-6 print:hidden">
              <Select value={currentTab} onValueChange={handleTabChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma seção" />
                </SelectTrigger>
                <SelectContent>
                  {tabOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="mb-6 print:hidden">
              <AdminNavMenu currentTab={currentTab} onTabChange={handleTabChange} />
            </div>
          )}

          <TabsContent value="overview">
            <div className="flex flex-col md:grid gap-6 md:grid-cols-3 items-start">
              <div className="order-1 md:order-none md:col-span-2 space-y-6">
                <UpcomingAppointments />
              </div>
              
              {/* Force this next to Upcoming Appointments on desktop, but 2nd on mobile */}
              <div className="order-2 md:order-none space-y-6 md:col-start-3 md:row-start-1 md:row-span-2">
                <BirthdaysList />
              </div>

              {/* Force this below Upcoming Appointments on desktop, but 3rd on mobile */}
              <div className="order-3 md:order-none md:col-span-2 grid gap-6 sm:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Profissionais</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isProfCountLoading ? (
                      <Skeleton className="h-10 w-24" />
                    ) : (
                      <div className="text-3xl font-bold">
                        {professionalsCount}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Profissionais (ativos)
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Pacientes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isCountsLoading ? (
                      <Skeleton className="h-10 w-24" />
                    ) : (
                      <div className="text-3xl font-bold">{clientsCount}</div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Pacientes ({translateStatus(clientStatusFilter)})
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="kpi">
            <KpiDashboard />
          </TabsContent>

          <TabsContent value="agenda">
            <Card>
              <CardContent className="p-0 sm:p-0">
                <AgendaView />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="professionals">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <CardTitle>Gerenciar Profissionais</CardTitle>
                  <Button
                    onClick={() => setIsProfessionalFormOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adicionar Profissional
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isProfessionalsLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ProfessionalsList professionals={professionals} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patients">
            <Card>
              <CardHeader>
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <CardTitle>Gerenciar Pacientes</CardTitle>
                  <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                    <div className="relative w-full sm:w-[300px]">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Buscar por nome ou CPF..."
                        className="pl-9 w-full"
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                      />
                    </div>
                    <Select
                      value={clientStatusFilter}
                      onValueChange={(v) =>
                        setClientStatusFilter(v as ClientStatusFilter)
                      }
                    >
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativos</SelectItem>
                        <SelectItem value="inactive">Inativos</SelectItem>
                        <SelectItem value="all">Todos</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={clientServiceFilter}
                      onValueChange={setClientServiceFilter}
                    >
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Serviços</SelectItem>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => setIsPatientFormOpen(true)}
                      className="w-full sm:w-auto"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Novo
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <PatientsList patients={filteredClients} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financials">
            <FinancialManagement />
          </TabsContent>

          <TabsContent value="subscriptions">
            <FinancialManagement />
          </TabsContent>

          <TabsContent value="timesheets">
            <TimeSheetReport />
          </TabsContent>

          <TabsContent value="messages">
            <MessageConfirmation />
          </TabsContent>

          <TabsContent value="services">

            <Card>
              <CardHeader>
                <CardTitle>Gerenciar Serviços e Pacotes</CardTitle>
              </CardHeader>
              <CardContent>
                <ServicesManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="partnerships">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciar Parcerias e Descontos</CardTitle>
              </CardHeader>
              <CardContent>
                <PartnershipsManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gallery">
            <ClinicalGalleryAdmin />
          </TabsContent>

          <TabsContent value="maintenance">
            <DataMaintenance />
          </TabsContent>
        </Tabs>
      </div>

      {/* Synchronized Modal Management: Only render when needed and safe */}
      {!loading && role === 'admin' && (
        <>
          <PatientFormDialog
            isOpen={isPatientFormOpen}
            onOpenChange={setIsPatientFormOpen}
            onPatientCreated={handlePatientCreated}
          />
          <ProfessionalFormDialog
            isOpen={isProfessionalFormOpen}
            onOpenChange={setIsProfessionalFormOpen}
            onProfessionalCreated={() => {
              if (currentTab === 'professionals') fetchLists()
            }}
          />
          <ClientOnboardingDialog
            client={newlyCreatedClient}
            isOpen={isOnboardingDialogOpen}
            onOpenChange={setIsOnboardingDialogOpen}
          />
        </>
      )}
    </>
  )
}

export default AdminDashboard

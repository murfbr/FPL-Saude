import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { cleanCPF } from '@/shared/lib/utils'
import { ClientsTable } from '@/modules/clients/components/ClientsTable'
import { getClientsByProfessional, getAllClients } from '@/shared/services'
import { Client } from '@/shared/types'
import { useToast } from '@/shared/hooks/use-toast'
import { AgendaView } from '@/modules/appointments/components/AgendaView'
import { ReadOnlyAvailabilitySettings } from '@/modules/availability/components/ReadOnlyAvailabilitySettings'
import { TimeTracker } from '@/modules/time-tracking/components/TimeTracker'
import ClinicalGalleryAdmin from '@/modules/gallery/pages/ClinicalGalleryAdmin'
import { useAuth } from '@/shared/providers/AuthProvider'
import { useTenant } from '@/shared/contexts/TenantContext'

const ProfessionalArea = () => {
  const { toast } = useToast()
  const { user, professionalId } = useAuth()
  const { config } = useTenant()
  const [searchParams, setSearchParams] = useSearchParams()
  const [clients, setClients] = useState<Client[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const currentTab = searchParams.get('tab') || 'schedule'

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value })
  }

  useEffect(() => {
    const fetchData = async () => {
      // If professionalId is null, we can't fetch clients.
      // But isLoading starts true. We need to stop loading if id is missing.
      if (!user || !professionalId) {
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      try {
        let clientRes
        if (config?.features?.professionals_view_all_clients) {
          // Quando a flag global estiver ativa, busca todos os clientes ativos da clínica
          clientRes = await getAllClients({ status: 'active' })
        } else {
          // Comportamento padrão: busca apenas os clientes que o profissional atendeu
          clientRes = await getClientsByProfessional(professionalId)
        }

        if (clientRes.error) throw new Error('Erro ao buscar clientes.')

        setClients(clientRes.data || [])
      } catch (error: any) {
        toast({
          title: 'Erro ao carregar dados',
          description: error.message,
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [toast, user, professionalId])

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-12 w-1/2 mb-2" />
        <Skeleton className="h-8 w-1/3 mb-8" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!professionalId) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <h2 className="text-2xl font-bold">
          Perfil de Profissional não encontrado
        </h2>
        <p className="text-muted-foreground mt-2">
          Seu usuário não está vinculado a um perfil de profissional válido.
          Entre em contato com o administrador.
        </p>
      </div>
    )
  }

  const lowerTerm = searchTerm.toLowerCase()
  const cleanTerm = cleanCPF(searchTerm)

  const filteredClients = clients.filter((client) => {
    const matchesName = client.name.toLowerCase().includes(lowerTerm)
    const matchesCPF =
      cleanTerm.length > 0 && client.email.includes(cleanTerm)
    // Usamos o field email que às vezes guarda o CPF limpo no modelo legado
    return matchesName || matchesCPF
  })

  const hasAgenda = config?.modules?.appointments?.enabled !== false
  const hasPatients = config?.modules?.clients?.enabled !== false
  const hasGallery = config?.modules?.gallery?.enabled === true
  const hasTimesheets = config?.modules?.time_tracking?.enabled === true

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold font-sans">Portal do Profissional</h1>
        <p className="text-lg text-muted-foreground">
          Gerencie sua agenda e seus pacientes.
        </p>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="flex flex-wrap w-full mb-6 gap-1 h-auto">
          {hasAgenda && <TabsTrigger value="schedule" className="flex-1 min-w-[120px]">Agenda</TabsTrigger>}
          {hasAgenda && <TabsTrigger value="availability" className="flex-1 min-w-[120px]">Disponibilidade</TabsTrigger>}
          {hasPatients && <TabsTrigger value="clients" className="flex-1 min-w-[120px]">Pacientes</TabsTrigger>}
          {hasGallery && <TabsTrigger value="gallery" className="flex-1 min-w-[120px]">Galeria</TabsTrigger>}
          {hasTimesheets && <TabsTrigger value="time-tracking" className="flex-1 min-w-[120px]">Ponto</TabsTrigger>}
        </TabsList>

        {hasAgenda && (
          <>
            <TabsContent value="schedule">
              <AgendaView 
                mode="professional" 
                preselectedProfessionalId={config?.features?.professionals_view_all_schedules ? 'all' : professionalId} 
              />
            </TabsContent>
            <TabsContent value="availability">
              <ReadOnlyAvailabilitySettings professionalId={professionalId} />
            </TabsContent>
          </>
        )}

        {hasPatients && (
          <TabsContent value="clients" className="space-y-4 mt-0">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CPF..."
                className="pl-8 w-full max-w-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <ClientsTable clients={filteredClients} />
          </TabsContent>
        )}

        {hasGallery && (
          <TabsContent value="gallery">
            <ClinicalGalleryAdmin />
          </TabsContent>
        )}

        {hasTimesheets && (
          <TabsContent value="time-tracking">
            <TimeTracker professionalId={professionalId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

export default ProfessionalArea

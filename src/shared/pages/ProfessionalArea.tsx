import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold font-sans">Portal do Profissional</h1>
        <p className="text-lg text-muted-foreground">
          Gerencie sua agenda e seus pacientes.
        </p>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="schedule">Agenda</TabsTrigger>
          <TabsTrigger value="availability">Disponibilidade</TabsTrigger>
          <TabsTrigger value="clients">Pacientes</TabsTrigger>
          <TabsTrigger value="gallery">Galeria</TabsTrigger>
          <TabsTrigger value="time-tracking">Ponto</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <AgendaView 
            mode="professional" 
            preselectedProfessionalId={config?.features?.professionals_view_all_schedules ? 'all' : professionalId} 
          />
        </TabsContent>

        <TabsContent value="availability">
          <ReadOnlyAvailabilitySettings professionalId={professionalId} />
        </TabsContent>

        <TabsContent value="clients">
          <ClientsTable clients={clients} />
        </TabsContent>

        <TabsContent value="gallery">
          <ClinicalGalleryAdmin />
        </TabsContent>

        <TabsContent value="time-tracking">
          <TimeTracker professionalId={professionalId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ProfessionalArea

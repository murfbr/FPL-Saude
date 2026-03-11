import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientsTable } from '@/components/professional/ClientsTable'
import { getClientsByProfessional } from '@/services'
import { Client } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/providers/AuthProvider'
import { Agenda } from '@/components/professional/Agenda'
import { TimeTracker } from '@/components/professional/TimeTracker'

const ProfessionalArea = () => {
  const { toast } = useToast()
  const { user, professionalId } = useAuth()
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
        const [clientRes] = await Promise.all([
          getClientsByProfessional(professionalId),
        ])

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
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="schedule">Agenda</TabsTrigger>
          <TabsTrigger value="clients">Pacientes</TabsTrigger>
          <TabsTrigger value="time-tracking">Ponto</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <Agenda professionalId={professionalId} />
        </TabsContent>

        <TabsContent value="clients">
          <ClientsTable clients={clients} />
        </TabsContent>

        <TabsContent value="time-tracking">
          <TimeTracker professionalId={professionalId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ProfessionalArea

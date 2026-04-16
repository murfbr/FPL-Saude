import { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search, UserSquare2, ChevronRight, User, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Client } from '@/shared/types'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientGallery } from '@/modules/gallery/components/ClientGallery'
import { getAllGalleryRecords } from '@/modules/gallery/service'
import { ClientSelector } from '@/modules/clients/components/ClientSelector'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface GalleryPatient {
  id: string
  name: string
  lastActivity: string
}

export default function ClinicalGalleryAdmin() {
  const [galleryPatients, setGalleryPatients] = useState<GalleryPatient[]>([])
  const [filteredPatients, setFilteredPatients] = useState<GalleryPatient[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  const [selectedClient, setSelectedClient] = useState<{ id: string, name: string } | null>(null)

  // Selector State (Lazy load clients)
  const [isSelectingClient, setIsSelectingClient] = useState(false)
  const [allClients, setAllClients] = useState<Client[]>([])
  const [isClientsLoading, setIsClientsLoading] = useState(false)

  const fetchActiveGalleryPatients = async () => {
    setIsLoading(true)
    const { data } = await getAllGalleryRecords()
    if (data) {
      // Group by patient ID efficiently
      const patientMap = new Map<string, GalleryPatient>()
      
      data.forEach(record => {
        if (!patientMap.has(record.client_id)) {
          patientMap.set(record.client_id, {
            id: record.client_id,
            name: record.client_name || 'Paciente Desconhecido',
            lastActivity: record.date
          })
        }
      })
      
      const patients = Array.from(patientMap.values())
      setGalleryPatients(patients)
      setFilteredPatients(patients)
    }
    setIsLoading(false)
  }

  // Load the gallery patients on startup
  useEffect(() => {
    fetchActiveGalleryPatients()
  }, [])

  // Refetch when returning from a workspace just to update the list if needed
  useEffect(() => {
    if (!selectedClient) {
      fetchActiveGalleryPatients()
    }
  }, [selectedClient])

  useEffect(() => {
    if (!searchTerm) {
      setFilteredPatients(galleryPatients)
      return
    }
    const lower = searchTerm.toLowerCase()
    setFilteredPatients(galleryPatients.filter(c => c.name.toLowerCase().includes(lower)))
  }, [searchTerm, galleryPatients])

  // Lazy load all clients for the selector ONLY when opening the modal
  useEffect(() => {
    if (isSelectingClient && allClients.length === 0) {
      const fetchClients = async () => {
        setIsClientsLoading(true)
        try {
          const { getAllClients } = await import('@/modules/clients/service')
          const { data } = await getAllClients({ status: 'active' })
          if (data) setAllClients(data)
        } catch (e) {
          console.error(e)
        } finally {
          setIsClientsLoading(false)
        }
      }
      fetchClients()
    }
  }, [isSelectingClient])

  // Se um paciente foi escolhido, renderiza o workspace dele
  if (selectedClient) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <button 
            onClick={() => setSelectedClient(null)}
            className="hover:text-primary hover:underline font-medium transition-colors"
          >
            Galeria Clínica
          </button>
          <ChevronRight className="w-4 h-4 opacity-50" />
          <span className="text-foreground font-semibold">{selectedClient.name}</span>
        </div>
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workspace Fotográfico</h1>
          <p className="text-muted-foreground mt-1">
            Espaço de evolução clínica para capturar e comparar as fotos de {selectedClient.name}.
          </p>
        </div>

        <ClientGallery clientId={selectedClient.id} clientName={selectedClient.name} />
      </div>
    )
  }

  // Lista de Busca Principal (Início)
  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Galeria Clínica</h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Acesse as evoluções cadastradas ou insira um novo paciente na galeria.
          </p>
        </div>
        <Button onClick={() => setIsSelectingClient(true)} className="gap-2">
           <Plus className="w-4 h-4" />
           Adicionar à Galeria
        </Button>
      </div>

      <Card className="border shadow-md">
        <CardHeader className="bg-muted/40 pb-4 border-b">
          <div className="relative w-full">
            <Search className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Pesquisar histórico da galeria..."
              className="pl-12 py-7 text-lg rounded-xl shadow-sm border-muted-foreground/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          ) : filteredPatients.length === 0 ? (
             <div className="text-center py-20 text-muted-foreground">
               <UserSquare2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
               <p className="font-medium text-foreground text-xl">Nenhuma galeria registrada</p>
               <p className="mt-1">Clique em "Adicionar à Galeria" para iniciar a primeira evolução.</p>
             </div>
          ) : (
            <div className="divide-y max-h-[60vh] overflow-y-auto">
              {filteredPatients.map(patient => (
                <div 
                  key={patient.id}
                  onClick={() => setSelectedClient(patient)}
                  className="p-5 flex items-center justify-between hover:bg-muted/60 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110 transition-all shadow-sm">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                        {patient.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Última evolução: {new Date(patient.lastActivity + "T12:00:00").toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" className="opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                    Visualizar Workspace
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isSelectingClient} onOpenChange={setIsSelectingClient}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular novo paciente à Galeria</DialogTitle>
          </DialogHeader>
          <div className="py-4">
             <ClientSelector 
                clients={allClients}
                value={''}
                onChange={(id) => {
                   const c = allClients.find(cl => cl.id === id)
                   if (c) {
                      setSelectedClient({ id: c.id, name: c.name })
                   }
                   setIsSelectingClient(false)
                }}
                isLoading={isClientsLoading}
             />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

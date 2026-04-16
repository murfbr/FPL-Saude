import { useState, useEffect } from 'react'
import { GalleryRecord } from '@/shared/types'
import { getClientGallery, deleteGalleryRecord } from '@/modules/gallery/service'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Camera, ImageOff, Trash2, Eye } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { GalleryUploadDialog } from './GalleryUploadDialog'
import { BeforeAfterSlider } from '@/shared/components/BeforeAfterSlider'
import { format } from 'date-fns'
import { useToast } from '@/shared/hooks/use-toast'
import ptBR from 'date-fns/locale/pt-BR'

interface ClientGalleryProps {
  clientId: string
  clientName: string
}

export function ClientGallery({ clientId, clientName }: ClientGalleryProps) {
  const [records, setRecords] = useState<GalleryRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<GalleryRecord | null>(null)
  const { toast } = useToast()

  const fetchGallery = async () => {
    setIsLoading(true)
    const { data } = await getClientGallery(clientId)
    if (data) setRecords(data)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchGallery()
  }, [clientId])

  const handleDelete = async (record: GalleryRecord, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent opening the dialog
    if (confirm('Tem certeza que deseja excluir esta comparação? O arquivo de imagem original também será deletado do Storage.')) {
      const pathsToDelete = []
      if (record.before_path) pathsToDelete.push(record.before_path)
      if (record.after_path) pathsToDelete.push(record.after_path)

      const { error } = await deleteGalleryRecord(record.id, pathsToDelete)
      if (error) {
        toast({ title: 'Erro ao excluir', variant: 'destructive' })
      } else {
        toast({ title: 'Comparação excluída com sucesso!' })
        fetchGallery()
        if (selectedRecord?.id === record.id) {
          setSelectedRecord(null)
        }
      }
    }
  }

  return (
    <Card className="flex-1 w-full mt-6 border overflow-hidden shadow-sm">
      <CardHeader className="bg-muted/30 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Galeria de Evolução
            </CardTitle>
            <CardDescription>Visualização visual do progresso dos procedimentos</CardDescription>
          </div>
          <Button onClick={() => setIsUploadOpen(true)} size="sm" className="shrink-0 gap-2">
            <Camera className="w-4 h-4" />
            Adicionar Fotos
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 sm:p-6 bg-background">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="aspect-square rounded-md" />)}
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-md">
            <ImageOff className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-medium text-foreground">Nenhuma foto registrada</p>
            <p className="text-sm">Clique em "Adicionar Fotos" para registrar a evolução.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {records.map(record => (
              <div 
                key={record.id} 
                className="group relative rounded-md border shadow-sm overflow-hidden aspect-square cursor-pointer bg-muted hover:ring-2 hover:ring-primary transition-all"
                onClick={() => setSelectedRecord(record)}
              >
                {/* Thumb using the `after` or `before` image */}
                <img 
                  src={record.after_url || record.before_url} 
                  alt={record.procedure_name} 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                />
                
                {/* Gradient overlay for text visibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                
                {/* Info Text */}
                <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col">
                  <span className="text-white font-semibold text-sm drop-shadow-md truncate">
                    {record.procedure_name}
                  </span>
                  <span className="text-white/80 text-xs drop-shadow-md">
                    {format(new Date(record.date), "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </span>
                </div>

                {/* Badge if it has both photos vs single photo */}
                <div className="absolute top-2 left-2 flex gap-1">
                  {(record.before_url && record.after_url) ? (
                     <span className="bg-primary/90 text-primary-foreground text-[10px] px-2 py-0.5 rounded font-bold shadow">Vs.</span>
                  ) : (
                     <span className="bg-muted-foreground/90 text-white text-[10px] px-2 py-0.5 rounded">Em Progresso</span>
                  )}
                </div>

                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                   <Button size="icon" variant="destructive" className="h-7 w-7 rounded-full shadow-lg" onClick={(e) => handleDelete(record, e)}>
                     <Trash2 className="h-3 w-3" />
                   </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <GalleryUploadDialog 
        isOpen={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        clientId={clientId}
        clientName={clientName}
        onSuccess={fetchGallery}
      />

      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-4xl p-0 h-[90vh] md:h-auto flex flex-col justify-start">
          {selectedRecord && (
            <>
              <DialogHeader className="p-6 pb-2 shrink-0">
                <DialogTitle>{selectedRecord.procedure_name}</DialogTitle>
                <div className="text-sm text-muted-foreground">
                  Avaliação em: {format(new Date(selectedRecord.date), "dd/MM/yyyy")}
                  {selectedRecord.professional_name && ` • Por: ${selectedRecord.professional_name}`}
                </div>
              </DialogHeader>
              <div className="p-6 pt-2 flex-grow overflow-y-auto">
                 <BeforeAfterSlider 
                    beforeUrl={selectedRecord.before_url}
                    afterUrl={selectedRecord.after_url}
                 />
                 {selectedRecord.description && (
                   <div className="mt-6 p-4 bg-muted/50 rounded-md border text-sm text-muted-foreground">
                     <p className="font-semibold text-foreground mb-1">Notas Clínicas:</p>
                     {selectedRecord.description}
                   </div>
                 )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

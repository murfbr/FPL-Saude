import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NoteEntry, Client } from '@/shared/types'
import { getClientNotesPaginated, getClientById } from '@/shared/services'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { useToast } from '@/shared/hooks/use-toast'

interface PatientHistoryModalProps {
  clientId: string | null
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export const PatientHistoryModal = ({
  clientId,
  isOpen,
  onOpenChange,
}: PatientHistoryModalProps) => {
  const { toast } = useToast()
  const [client, setClient] = useState<Client | null>(null)
  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 10

  useEffect(() => {
    if (isOpen && clientId) {
      loadClientData()
      loadNotes(1)
    } else {
      setNotes([])
      setClient(null)
      setPage(1)
      setTotalCount(0)
    }
  }, [isOpen, clientId])

  const loadClientData = async () => {
    if (!clientId) return
    const { data } = await getClientById(clientId)
    if (data) {
      setClient(data)
    }
  }

  const loadNotes = async (pageNumber: number) => {
    if (!clientId) return
    setIsLoading(true)
    const { data, totalCount: total, error } = await getClientNotesPaginated(
      clientId,
      pageNumber,
      pageSize
    )
    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as avaliações.',
        variant: 'destructive',
      })
    } else if (data) {
      setNotes(data)
      setTotalCount(total)
      setPage(pageNumber)
    }
    setIsLoading(false)
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-xl">
        <DialogHeader className="px-4 sm:px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <FileText className="w-5 h-5 text-primary" />
            Prontuário Completo
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {client ? `Paciente: ${client.name}` : 'Carregando paciente...'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col bg-muted/10">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6" style={{ WebkitOverflowScrolling: 'touch' }}>
            {isLoading && notes.length === 0 ? (
              <div className="flex justify-center items-center h-full min-h-[200px]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : notes.length > 0 ? (
              <div className="space-y-4 sm:space-y-6">
                {notes.map((note, index) => (
                  <div key={index} className="bg-background p-4 rounded-lg border shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 pb-2 border-b gap-1">
                      <span className="font-semibold text-sm text-primary">
                        {note.professional_name || 'Profissional Desconhecido'}
                      </span>
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        {format(new Date(note.date), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto opacity-20 mb-3" />
                <p className="text-sm">Nenhuma evolução ou avaliação encontrada.</p>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalCount > pageSize && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 py-3 border-t bg-background shrink-0 gap-3">
              <span className="text-xs sm:text-sm text-muted-foreground text-center">
                Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, totalCount)} de {totalCount} avaliações
              </span>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={() => loadNotes(page - 1)}
                  disabled={page === 1 || isLoading}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={() => loadNotes(page + 1)}
                  disabled={page === totalPages || isLoading}
                >
                  Próxima
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { StickyNote, ExternalLink, Loader2, Send } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface NotesSectionProps {
  state: any
  actions: any
}

export const NotesSection = ({ state, actions }: NotesSectionProps) => {
  const {
    lastNotes,
    localNotes,
    newNote,
    isSavingNote,
  } = state

  const {
    setIsHistoryModalOpen,
    setNewNote,
    handleAddNote,
  } = actions

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-primary" />
          Prontuário e Histórico
        </Label>
        <button
          onClick={() => setIsHistoryModalOpen(true)}
          className="text-[10px] text-primary hover:underline flex items-center gap-1"
        >
          Ver Prontuário Completo
          <ExternalLink className="h-2.5 w-2.5" />
        </button>
      </div>
      <ScrollArea className="h-[250px] w-full rounded-md border p-4 bg-muted/10">
        <div className="space-y-6">
          {/* Previous Notes (History) */}
          {lastNotes.length > 0 && (
            <div className="space-y-4">
              {lastNotes.map((note: any, index: number) => (
                <div key={`history-${index}`} className="relative pl-4 border-l-2 border-muted">
                   <div className="flex justify-between items-center mb-1">
                     <span className="font-semibold text-[10px] text-muted-foreground italic">
                       Histórico: {note.professional_name}
                     </span>
                     <span className="text-[10px] text-muted-foreground">
                       {format(new Date(note.date), "dd/MM/yy", { locale: ptBR })}
                     </span>
                   </div>
                   <p className="text-xs text-muted-foreground/80 line-clamp-3">
                     {note.content}
                   </p>
                </div>
              ))}
              <div className="flex items-center gap-2 py-2">
                <div className="h-[1px] flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Início da Sessão Atual</span>
                <div className="h-[1px] flex-1 bg-border" />
              </div>
            </div>
          )}

          {/* Current Session Notes */}
          {localNotes && localNotes.length > 0 ? (
            <div className="space-y-4">
              {localNotes.map((note: any, index: number) => (
                <div
                  key={`current-${index}`}
                  className="bg-background p-3 rounded-lg border shadow-sm"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-xs text-primary">
                      {note.professional_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(
                        new Date(note.date),
                        "dd/MM/yy 'às' HH:mm",
                        { locale: ptBR },
                      )}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {lastNotes.length > 0 ? 'Nenhuma evolução registrada nesta sessão ainda.' : 'Nenhuma anotação registrada.'}
            </p>
          )}
        </div>
      </ScrollArea>
      <div className="flex gap-2">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          className="min-h-[80px]"
          placeholder="Adicionar nova anotação..."
        />
        <Button
          size="icon"
          className="h-auto"
          onClick={handleAddNote}
          disabled={isSavingNote || !newNote.trim()}
        >
          {isSavingNote ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

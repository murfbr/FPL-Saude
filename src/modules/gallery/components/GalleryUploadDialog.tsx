import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/shared/hooks/use-toast'
import { Camera, ImagePlus, Loader2, Play } from 'lucide-react'
import { uploadGalleryPhoto, createGalleryRecord } from '@/modules/gallery/service'
import { useAuth } from '@/shared/providers/AuthProvider'
import { format } from 'date-fns'

interface GalleryUploadDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  clientName?: string
  onSuccess: () => void
}

export function GalleryUploadDialog({
  isOpen,
  onOpenChange,
  clientId,
  clientName,
  onSuccess
}: GalleryUploadDialogProps) {
  const { toast } = useToast()
  const { user, professionalId } = useAuth()
  
  const [isUploading, setIsUploading] = useState(false)
  
  const [procedureName, setProcedureName] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [description, setDescription] = useState('')
  
  const [beforeFile, setBeforeFile] = useState<File | null>(null)
  const [afterFile, setAfterFile] = useState<File | null>(null)

  const beforeInputRef = useRef<HTMLInputElement>(null)
  const afterInputRef = useRef<HTMLInputElement>(null)

  const handleReset = () => {
    setProcedureName('')
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setDescription('')
    setBeforeFile(null)
    setAfterFile(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!procedureName.trim()) {
      toast({ title: 'O nome do procedimento é obrigatório', variant: 'destructive' })
      return
    }
    if (!beforeFile && !afterFile) {
      toast({ title: 'Adicione pelo menos uma foto', variant: 'destructive' })
      return
    }

    setIsUploading(true)

    try {
      let beforeUrl, beforePath, afterUrl, afterPath

      // Upload Before
      if (beforeFile) {
        const res = await uploadGalleryPhoto(clientId, beforeFile, 'before')
        if (res.error) throw res.error
        beforeUrl = res.url
        beforePath = res.path
      }

      // Upload After
      if (afterFile) {
        const res = await uploadGalleryPhoto(clientId, afterFile, 'after')
        if (res.error) throw res.error
        afterUrl = res.url
        afterPath = res.path
      }

      const { error } = await createGalleryRecord({
        client_id: clientId,
        client_name: clientName,
        procedure_name: procedureName,
        date,
        description,
        before_url: beforeUrl || undefined,
        before_path: beforePath || undefined,
        after_url: afterUrl || undefined,
        after_path: afterPath || undefined,
        professional_id: professionalId || undefined,
        professional_name: user?.displayName || user?.email || 'Profissional'
      })

      if (error) throw error

      toast({ title: 'Fotos enviadas com sucesso!' })
      onSuccess()
      handleReset()
      onOpenChange(false)
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
    } finally {
      setIsUploading(false)
    }
  }

  const renderPhotoSelector = (
    label: string, 
    file: File | null, 
    setFile: (f: File | null) => void, 
    inputRef: React.RefObject<HTMLInputElement>,
    themeColor: string
  ) => {
    return (
      <div className="flex justify-between items-center p-3 border rounded-md bg-muted/30">
        <div className="flex flex-col">
          <span className={`font-semibold text-sm ${themeColor}`}>{label}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-[200px]">
            {file ? file.name : 'Nenhuma imagem selecionada'}
          </span>
        </div>
        
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" // Forces rear camera on mobile
          className="hidden" 
          ref={inputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              setFile(e.target.files[0])
            }
          }}
        />

        <div className="flex gap-2">
          {file && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)}>
              Remover
            </Button>
          )}
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => inputRef.current?.click()}
          >
            {file ? <ImagePlus className="w-4 h-4 mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
            {file ? 'Trocar' : 'Capturar'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova Comparação de Evolução</DialogTitle>
          <DialogDescription>
            Registre o progresso clínico enviando fotos do antes e depois. Você pode enviar apenas uma foto e atualizar a outra no futuro.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="procedure">Nome do Procedimento / Tratamento *</Label>
            <Input
              id="procedure"
              placeholder="Ex: Preenchimento Labial"
              value={procedureName}
              onChange={(e) => setProcedureName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Data da Avaliação</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-3 pt-2">
            <Label>Captura de Imagens</Label>
            {renderPhotoSelector('ANTES', beforeFile, setBeforeFile, beforeInputRef, 'text-red-500/80')}
            {renderPhotoSelector('DEPOIS', afterFile, setAfterFile, afterInputRef, 'text-green-500/80')}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Observações Clínícas (Opcional)</Label>
            <Textarea
              id="description"
              placeholder="Anotações sobre a evolução..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>

          <div className="flex justify-end pt-4 space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                handleReset()
                onOpenChange(false)
              }}
              disabled={isUploading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isUploading || (!beforeFile && !afterFile)}>
              {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Registro
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

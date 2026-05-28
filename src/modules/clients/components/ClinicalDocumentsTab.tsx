import { useState, useEffect } from 'react'
import { Client, ClinicalDocument, ClinicalDocumentType } from '@/shared/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileText, Plus, Loader2, Download, Printer, Edit, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuth } from '@/shared/providers/AuthProvider'
import { useTenant } from '@/shared/contexts/TenantContext'
import { useToast } from '@/shared/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { getClinicalDocuments, saveClinicalDocument, updateClinicalDocument, deleteClinicalDocument } from '../services/documents'
import jsPDF from 'jspdf'

interface ClinicalDocumentsTabProps {
  client: Client
}

export const ClinicalDocumentsTab = ({ client }: ClinicalDocumentsTabProps) => {
  const [documents, setDocuments] = useState<ClinicalDocument[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  
  const [newDocType, setNewDocType] = useState<ClinicalDocumentType>('atestado')
  const [newDocContent, setNewDocContent] = useState('')
  
  const { user, professionalId, role } = useAuth()
  const { config } = useTenant()
  const { toast } = useToast()

  const professionalName = user?.displayName || user?.email || (role === 'admin' ? 'Administrador' : 'Profissional')

  const fetchDocuments = async () => {
    if (!client.id) return
    setIsLoading(true)
    const { data } = await getClinicalDocuments(client.id)
    if (data) setDocuments(data)
    setIsLoading(false)
  }

  useEffect(() => {
    fetchDocuments()
  }, [client.id])

  const generatePDF = (docType: string, content: string, date: Date = new Date()) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    
    // Borda da página
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.rect(10, 10, pageWidth - 20, pageHeight - 20)
    
    // Cabeçalho (Timbre)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 64, 175) // Azul primário
    doc.text('FPL Saúde', pageWidth / 2, 25, { align: 'center' })
    
    // Subtítulo do cabeçalho
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(config?.subtitle || 'Clínica de Especialidades', pageWidth / 2, 32, { align: 'center' })

    if (config?.cnpj) {
      doc.setFontSize(9)
      doc.text(`CNPJ: ${config.cnpj}`, pageWidth / 2, 37, { align: 'center' })
    }

    // Linha separadora do cabeçalho
    doc.setDrawColor(200, 200, 200)
    const lineY = config?.cnpj ? 41 : 38
    doc.line(20, lineY, pageWidth - 20, lineY)
    
    // Título do Documento
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    let displayType = docType.toUpperCase()
    if (docType === 'receita') displayType = 'RECEITUÁRIO'
    doc.text(displayType, pageWidth / 2, lineY + 12, { align: 'center' })
    
    // Dados do Paciente
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    const startContentY = lineY + 27
    doc.text('Paciente:', 20, startContentY)
    doc.setFont('helvetica', 'normal')
    doc.text(client.name, 42, startContentY)
    
    if (client.email && client.email.length === 11) {
       doc.setFont('helvetica', 'bold')
       doc.text('CPF:', 20, startContentY + 7)
       doc.setFont('helvetica', 'normal')
       // Formatação simples de CPF
       const cpf = client.email.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
       doc.text(cpf, 32, startContentY + 7)
    }
    
    // Corpo do Texto
    doc.setFontSize(12)
    const textLines = doc.splitTextToSize(content, pageWidth - 40)
    doc.text(textLines, 20, startContentY + 25)
    
    // Rodapé / Assinatura
    doc.setDrawColor(0, 0, 0)
    doc.line(pageWidth / 2 - 40, pageHeight - 50, pageWidth / 2 + 40, pageHeight - 50) // Linha de assinatura
    
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(professionalName, pageWidth / 2, pageHeight - 42, { align: 'center' })
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Data: ${format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, pageWidth / 2, pageHeight - 34, { align: 'center' })
    
    return doc
  }

  const handleGenerateDocument = async () => {
    if (!newDocContent.trim()) {
      toast({ title: 'Preencha o conteúdo do documento.', variant: 'destructive' })
      return
    }
    
    setIsGenerating(true)
    
    try {
      // 1. Gerar PDF
      const pdf = generatePDF(newDocType, newDocContent)
      const pdfBlob = pdf.output('blob')
      const pdfFile = new File([pdfBlob], `${newDocType}.pdf`, { type: 'application/pdf' })
      
      let finalFileUrl = ''
      
      if (editingDocId) {
        // Edit mode
        const { data, error } = await updateClinicalDocument(client.id, editingDocId, {
          type: newDocType,
          content: newDocContent
        }, pdfFile)
        if (error) throw error
        
        finalFileUrl = data?.file_url || ''
        toast({ title: 'Documento atualizado e salvo no Storage com sucesso!' })
        if (data) setDocuments(prev => prev.map(d => d.id === editingDocId ? data : d))
      } else {
        // Create mode
        const { data, error } = await saveClinicalDocument(client.id, {
          professional_id: professionalId || user?.id || 'admin',
          professional_name: professionalName,
          type: newDocType,
          content: newDocContent
        }, pdfFile)
        if (error) throw error
        
        finalFileUrl = data?.file_url || ''
        toast({ title: 'Documento criado e salvo no Storage com sucesso!' })
        if (data) setDocuments(prev => [data, ...prev])
      }
      
      // 3. Abrir PDF para impressão/download
      if (finalFileUrl) {
        window.open(finalFileUrl, '_blank')
      } else {
        pdf.autoPrint()
        window.open(pdf.output('bloburl'), '_blank')
      }
      
      // 4. Limpar e atualizar
      setNewDocContent('')
      setIsCreating(false)
      setEditingDocId(null)
      
    } catch (err: any) {
      toast({ title: 'Erro ao gerar documento', description: err.message, variant: 'destructive' })
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePrintExisting = (document: ClinicalDocument) => {
    if (document.file_url) {
      window.open(document.file_url, '_blank')
    } else {
      // Backward compatibility for documents generated before we saved the file
      const pdf = generatePDF(document.type, document.content, new Date(document.created_at || ''))
      window.open(pdf.output('bloburl'), '_blank')
    }
  }

  const startEdit = (doc: ClinicalDocument) => {
    setNewDocType(doc.type)
    setNewDocContent(doc.content)
    setEditingDocId(doc.id || null)
    setIsCreating(true)
  }

  const cancelEdit = () => {
    setIsCreating(false)
    setEditingDocId(null)
    setNewDocContent('')
    setNewDocType('atestado')
  }

  const handleDelete = async (docId: string) => {
    if (!client.id) return
    setIsDeleting(docId)
    const { error } = await deleteClinicalDocument(client.id, docId)
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Documento excluído.' })
      setDocuments(prev => prev.filter(d => d.id !== docId))
    }
    setIsDeleting(null)
  }

  return (
    <div className="space-y-6">
      {isCreating ? (
        <Card className="border-primary/50 shadow-sm">
          <CardHeader className="pb-3 bg-muted/30">
            <CardTitle className="text-lg flex justify-between items-center">
              <span>{editingDocId ? 'Editar Documento' : 'Novo Documento Clínico'}</span>
              <Button variant="ghost" size="sm" onClick={cancelEdit}>Cancelar</Button>
            </CardTitle>
            <CardDescription>Preencha os dados abaixo para gerar o PDF.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Tipo de Documento</Label>
              <Select value={newDocType} onValueChange={(v: any) => setNewDocType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="atestado">Atestado Médico/Odontológico</SelectItem>
                  <SelectItem value="receita">Receituário</SelectItem>
                  <SelectItem value="encaminhamento">Encaminhamento</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Conteúdo do Documento</Label>
              <Textarea 
                placeholder="Digite o texto que vai no corpo do documento..." 
                className="min-h-[150px] resize-y"
                value={newDocContent}
                onChange={(e) => setNewDocContent(e.target.value)}
              />
            </div>
            
            <div className="flex justify-end pt-2">
              <Button onClick={handleGenerateDocument} disabled={isGenerating || !newDocContent.trim()}>
                {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
                Gerar PDF e Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" /> Histórico de Documentos ({documents.length})
          </h3>
          <Button size="sm" onClick={() => setIsCreating(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Documento
          </Button>
        </div>
      )}

      <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-background">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
            <FileText className="w-12 h-12 mb-4" />
            <p>Nenhum documento gerado ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {documents.map((doc) => (
              <div 
                key={doc.id} 
                className="flex items-start justify-between p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex gap-4 w-full">
                  <div className="p-2.5 rounded-full bg-primary/10 text-primary mt-1">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge variant="outline" className="uppercase font-semibold tracking-wider bg-primary/5 text-primary border-primary/20 mb-1">
                          {doc.type === 'receita' ? 'Receituário' : doc.type}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Emitido em {format(new Date(doc.created_at || ''), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handlePrintExisting(doc)}
                          className="text-primary hover:text-primary hover:bg-primary/10 h-8 w-8"
                          title="Visualizar / Imprimir"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => startEdit(doc)}
                          className="text-muted-foreground hover:text-primary h-8 w-8"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                              title="Excluir"
                            >
                              {isDeleting === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Documento</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza? O documento será excluído permanentemente do histórico do paciente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(doc.id!)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Confirmar Exclusão
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="mt-3 p-3 bg-background border rounded-md">
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground line-clamp-3">
                        {doc.content}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 text-right">
                      Por: {doc.professional_name}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

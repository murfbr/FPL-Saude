import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useToast } from '@/shared/hooks/use-toast'
import { Client } from '@/shared/types'
import { FileText, Loader2, Save, Download, History, Plus, File, Upload, Download as DownloadIcon, Trash2 } from 'lucide-react'
import { updateClient, exportClientData, getClientExams, uploadClientExam, deleteClientExam } from '@/shared/services'
import { ClientExam } from '@/shared/types'
import { useAuth } from '@/shared/providers/AuthProvider'
import { ref, getDownloadURL } from 'firebase/storage'
import { storage } from '@/shared/lib/firebase'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select as UiSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const assessmentSchema = z.object({
  mainComplaint: z.string().optional(),
  historyOfPresentIllness: z.string().optional(),
  pastMedicalHistory: z.string().optional(),
  medications: z.string().optional(),
  physicalExam: z.string().optional(),
  diagnosis: z.string().optional(),
  treatmentPlan: z.string().optional(),
})

type AssessmentFormValues = z.infer<typeof assessmentSchema>

interface GeneralAssessmentFormProps {
  client: Client
}

export const GeneralAssessmentForm = ({
  client,
}: GeneralAssessmentFormProps) => {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [historyText, setHistoryText] = useState('')
  const [activeTab, setActiveTab] = useState('assessment')
  const { user, role, professionalId } = useAuth()

  const [exams, setExams] = useState<ClientExam[]>([])
  const [isUploadingExam, setIsUploadingExam] = useState(false)
  const [isLoadingExams, setIsLoadingExams] = useState(false)
  const [newExamName, setNewExamName] = useState('')
  const [newExamType, setNewExamType] = useState<'exame' | 'laudo'>('exame')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isExamDialogOpen, setIsExamDialogOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState<string | null>(null)

  // Data parsing
  const { assessmentData, historyData } = useMemo(() => {
    const raw = client.general_assessment
    if (Array.isArray(raw)) {
      return {
        assessmentData:
          raw.find((i: any) => i.type === 'assessment' || !i.type) || {},
        historyData:
          raw.filter((i: any) => i.type === 'imported_history') || [],
      }
    }
    if (raw && typeof raw === 'object') {
      return { assessmentData: raw, historyData: [] }
    }
    return { assessmentData: {}, historyData: [] }
  }, [client.general_assessment])

  const form = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      mainComplaint: '',
      historyOfPresentIllness: '',
      pastMedicalHistory: '',
      medications: '',
      physicalExam: '',
      diagnosis: '',
      treatmentPlan: '',
    },
  })

  useEffect(() => {
    form.reset(assessmentData as AssessmentFormValues)
  }, [assessmentData, form])

  const fetchExams = async () => {
    if (!client.id) return
    setIsLoadingExams(true)
    const { data } = await getClientExams(client.id)
    if (data) setExams(data)
    setIsLoadingExams(false)
  }

  useEffect(() => {
    if (activeTab === 'exams') {
      fetchExams()
    }
  }, [activeTab, client.id])

  const handleUploadExam = async () => {
    if (!client.id || !selectedFile || !newExamName.trim()) return
    setIsUploadingExam(true)

    const examPayload: any = {
      client_id: client.id,
      name: newExamName,
      type: newExamType,
      professional_name: user?.displayName || user?.email || (role === 'admin' ? 'Administrador' : 'Profissional')
    }

    if (professionalId) {
      examPayload.professional_id = professionalId
    }

    const { data, error } = await uploadClientExam(
      client.id,
      examPayload,
      selectedFile
    )

    if (error) {
       toast({ title: 'Erro ao enviar arquivo', description: error.message, variant: 'destructive' })
    } else {
       toast({ title: 'Arquivo enviado com sucesso!' })
       setIsExamDialogOpen(false)
       setNewExamName('')
       setSelectedFile(null)
       fetchExams()
    }
    setIsUploadingExam(false)
  }

  const handleDeleteExam = async (exam: ClientExam) => {
    if (!client.id) return
    const { error } = await deleteClientExam(client.id, exam.id, exam.file_path)
    if (error) {
       toast({ title: 'Erro ao excluir arquivo', variant: 'destructive' })
    } else {
       toast({ title: 'Arquivo excluído com sucesso!' })
       fetchExams()
    }
  }

  const handleDownload = async (exam: ClientExam) => {
    try {
      setIsDownloading(exam.id)
      const storageRef = ref(storage, exam.file_path)
      const url = await getDownloadURL(storageRef)
      window.open(url, '_blank')
    } catch (error: any) {
      console.error("Erro ao baixar arquivo:", error)
      toast({ 
        title: 'Erro ao baixar arquivo', 
        description: error.message === 'Firebase Storage: User does not have permission to access the object.' 
          ? 'Sem permissão. Verifique as regras de acesso do Storage.' 
          : 'Erro ao gerar link de acesso.',
        variant: 'destructive' 
      })
    } finally {
      setIsDownloading(null)
    }
  }

  const onSubmit = async (values: AssessmentFormValues) => {
    setIsSubmitting(true)

    const newAssessmentEntry = {
      type: 'assessment',
      ...values,
      updated_at: new Date().toISOString(),
    }

    // Preserve history and other entries
    const raw = client.general_assessment
    let otherEntries: any[] = []
    if (Array.isArray(raw)) {
      otherEntries = raw.filter((i: any) => i.type !== 'assessment' && i.type)
    }

    const updatedAssessment = [newAssessmentEntry, ...otherEntries]

    const { error } = await updateClient(client.id, {
      general_assessment: updatedAssessment,
    })

    if (error) {
      toast({
        title: 'Erro ao salvar avaliação',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Avaliação atualizada com sucesso!' })
    }
    setIsSubmitting(false)
  }

  const handleImportHistory = async () => {
    if (!historyText.trim()) return
    setIsSubmitting(true)

    const newHistoryEntry = {
      type: 'imported_history',
      content: historyText,
      date: new Date().toISOString(),
    }

    const raw = client.general_assessment
    let currentList: any[] = []

    if (Array.isArray(raw)) {
      currentList = [...raw]
    } else if (raw && typeof raw === 'object') {
      currentList = [raw]
    }

    const updatedAssessment = [...currentList, newHistoryEntry]

    const { error } = await updateClient(client.id, {
      general_assessment: updatedAssessment,
    })

    if (error) {
      toast({
        title: 'Erro ao importar histórico',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Histórico importado com sucesso!' })
      setHistoryText('')
    }
    setIsSubmitting(false)
  }

  const handleExport = async (format: 'pdf' | 'docx') => {
    setIsExporting(true)
    const { data, error } = await exportClientData(
      client.id,
      'general_assessment',
      format,
    )

    if (error) {
      toast({
        title: 'Erro ao exportar',
        description: error.message,
        variant: 'destructive',
      })
    } else if (data) {
      const link = document.createElement('a')
      link.href = `data:application/${format === 'pdf' ? 'pdf' : 'vnd.openxmlformats-officedocument.wordprocessingml.document'};base64,${data.content}`
      link.download = data.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast({ title: 'Download iniciado!' })
    }
    setIsExporting(false)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> Informações Gerais
          </CardTitle>
          <CardDescription>
            Ficha de avaliação fisioterapêutica e anamnese.
          </CardDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleExport('pdf')}>
              Exportar como PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('docx')}>
              Exportar como DOCX
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="assessment">Ficha de Avaliação</TabsTrigger>
            <TabsTrigger value="history">Histórico Importado</TabsTrigger>
            <TabsTrigger value="exams">Laudos / Exames</TabsTrigger>
          </TabsList>

          <TabsContent value="assessment">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="mainComplaint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Queixa Principal (QP)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva a queixa principal do paciente..."
                          className="resize-none min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="historyOfPresentIllness"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>História da Doença Atual (HDA)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Histórico do problema atual..."
                            className="resize-none min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pastMedicalHistory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          História Patológica Pregressa (HPP)
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Cirurgias, traumas, doenças prévias..."
                            className="resize-none min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="medications"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medicamentos em Uso</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Liste os medicamentos..."
                          className="resize-none min-h-[60px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="physicalExam"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exame Físico</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Observações do exame físico (inspeção, palpação, amplitude de movimento, força, testes especiais)..."
                          className="resize-none min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="diagnosis"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Diagnóstico Cinético-Funcional</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Conclusão diagnóstica..."
                            className="resize-none min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="treatmentPlan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plano de Tratamento</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Objetivos e condutas..."
                            className="resize-none min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar Avaliação
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card className="bg-muted/30 border-dashed">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Importar Histórico
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={historyText}
                  onChange={(e) => setHistoryText(e.target.value)}
                  placeholder="Cole aqui o texto do histórico antigo do paciente para importar..."
                  className="min-h-[150px]"
                />
                <Button
                  onClick={handleImportHistory}
                  disabled={isSubmitting || !historyText.trim()}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar no Histórico
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <History className="w-4 h-4" /> Registros Importados (
                {historyData.length})
              </h3>
              <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-background">
                {historyData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">
                    Nenhum histórico importado.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {historyData
                      .sort(
                        (a: any, b: any) =>
                          new Date(b.date).getTime() -
                          new Date(a.date).getTime(),
                      )
                      .map((item: any, idx: number) => (
                        <div key={idx} className="border-b pb-4 last:border-0">
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-semibold text-primary">
                              Importado
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(
                                new Date(item.date),
                                "dd/MM/yyyy 'às' HH:mm",
                                { locale: ptBR },
                              )}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                            {item.content}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="exams" className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <File className="w-4 h-4" /> Arquivos Anexados ({exams.length})
              </h3>
              <AlertDialog open={isExamDialogOpen} onOpenChange={setIsExamDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Novo Anexo
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Anexar Documento</AlertDialogTitle>
                    <AlertDialogDescription>
                      Selecione um arquivo (PDF ou Imagem) para anexar ao prontuário.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nome do Documento</Label>
                      <Input 
                        placeholder="Ex: Laudo Ressonância" 
                        value={newExamName}
                        onChange={(e) => setNewExamName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <UiSelect value={newExamType} onValueChange={(val: any) => setNewExamType(val)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="exame">Exame</SelectItem>
                          <SelectItem value="laudo">Laudo</SelectItem>
                        </SelectContent>
                      </UiSelect>
                    </div>
                    <div className="space-y-2">
                      <Label>Arquivo</Label>
                      <Input 
                        type="file" 
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <Button 
                      onClick={handleUploadExam} 
                      disabled={isUploadingExam || !selectedFile || !newExamName.trim()}
                    >
                      {isUploadingExam ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                      Fazer Upload
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-background">
              {isLoadingExams ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : exams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
                  <File className="w-12 h-12 mb-4" />
                  <p>Nenhum documento anexado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {exams.map((exam) => (
                    <div 
                      key={exam.id} 
                      className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-full ${exam.type === 'laudo' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{exam.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {exam.type.charAt(0).toUpperCase() + exam.type.slice(1)} • {format(new Date(exam.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Enviado por: {exam.professional_name || 'Desconhecido'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDownload(exam)} 
                          disabled={isDownloading === exam.id}
                          title="Baixar"
                        >
                          {isDownloading === exam.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <DownloadIcon className="w-4 h-4" />
                          )}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Excluir">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Anexo</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o arquivo <strong>{exam.name}</strong>?
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteExam(exam)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Confirmar Exclusão
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

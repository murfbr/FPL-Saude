import { useState, useEffect, useMemo } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ClientSelector } from '@/modules/clients/components/ClientSelector'
import { useToast } from '@/shared/hooks/use-toast'
import { Client, ReceiptItem, Receipt } from '@/shared/types'
import {
  getActivitiesForReceipt,
  generateReceiptPDF,
  saveReceipt,
  getClientReceipts,
} from '../services/receipts'
import { getAllClients } from '@/modules/clients/service'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2, Receipt as ReceiptIcon, Printer, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/shared/providers/AuthProvider'
import { useTenant } from '@/shared/contexts/TenantContext'

export const ReceiptsTab = () => {
  const { toast } = useToast()
  const { user, professionalId } = useAuth()
  const { config } = useTenant()
  const [clients, setClients] = useState<Client[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  
  const [activities, setActivities] = useState<ReceiptItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [manualTotal, setManualTotal] = useState<string>('')
  
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  
  const [history, setHistory] = useState<Receipt[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Fetch Clients
  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await getAllClients()
      if (data) {
        setClients(data)
      }
    }
    fetchClients()
  }, [])

  const filteredClients = useMemo(() => {
    return clients.filter((c) => showInactive || c.is_active)
  }, [clients, showInactive])

  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId)
  }, [clients, selectedClientId])

  const fetchActivities = async () => {
    if (!selectedClientId || !startDate || !endDate) return
    setIsLoading(true)
    const { data, error } = await getActivitiesForReceipt(selectedClientId, startDate, endDate)
    if (error) {
      toast({ title: 'Erro ao buscar atividades', description: error.message, variant: 'destructive' })
    } else if (data) {
      setActivities(data)
      // Auto-select valid items (not pre-period)
      const initialSelected = new Set<string>()
      data.forEach(item => {
        if (!item.isPrePeriod && !item.isUnpaid) {
          initialSelected.add(item.id)
        }
      })
      setSelectedItems(initialSelected)
    }
    setIsLoading(false)
  }

  const fetchHistory = async () => {
    if (!selectedClientId) return
    setIsLoadingHistory(true)
    const { data } = await getClientReceipts(selectedClientId)
    if (data) setHistory(data)
    setIsLoadingHistory(false)
  }

  useEffect(() => {
    if (selectedClientId) {
      fetchActivities()
      fetchHistory()
    } else {
      setActivities([])
      setHistory([])
    }
  }, [selectedClientId, startDate, endDate])

  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const calculatedTotal = useMemo(() => {
    return activities
      .filter(item => selectedItems.has(item.id))
      .reduce((sum, item) => sum + item.amount, 0)
  }, [activities, selectedItems])

  useEffect(() => {
    setManualTotal(calculatedTotal.toString())
  }, [calculatedTotal])

  const handleGenerate = async () => {
    if (!selectedClient) return
    
    const finalTotal = parseFloat(manualTotal)
    if (isNaN(finalTotal) || finalTotal < 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' })
      return
    }

    const itemsToInclude = activities.filter(i => selectedItems.has(i.id))
    if (itemsToInclude.length === 0) {
      toast({ title: 'Selecione ao menos um item', variant: 'destructive' })
      return
    }

    setIsGenerating(true)
    try {
      const receiptData: Omit<Receipt, 'id' | 'created_at' | 'file_url' | 'file_path'> = {
        client_id: selectedClient.id,
        professional_id: professionalId || user?.id || 'admin',
        professional_name: user?.displayName || user?.email || 'Profissional',
        start_date: startDate,
        end_date: endDate,
        total_amount: finalTotal,
        items: itemsToInclude
      }

      const pdf = generateReceiptPDF(receiptData, selectedClient.name, selectedClient.email, config?.cnpj, config?.subtitle)
      const pdfBlob = pdf.output('blob')

      const { data, error } = await saveReceipt(selectedClient.id, receiptData, pdfBlob)
      if (error) throw error

      toast({ title: 'Recibo gerado com sucesso!' })
      
      if (data?.file_url) {
        window.open(data.file_url, '_blank')
      } else {
        window.open(pdf.output('bloburl'), '_blank')
      }
      
      fetchHistory()
    } catch (err: any) {
      toast({ title: 'Erro ao gerar recibo', description: err.message, variant: 'destructive' })
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePrintHistory = (receipt: Receipt) => {
    if (receipt.file_url) {
      window.open(receipt.file_url, '_blank')
    } else if (selectedClient) {
      // Fallback if not in storage
      const pdf = generateReceiptPDF(receipt, selectedClient.name, selectedClient.email, config?.cnpj, config?.subtitle)
      window.open(pdf.output('bloburl'), '_blank')
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[1fr_300px]">
        {/* Lado Esquerdo: Formulário */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados do Recibo</CardTitle>
              <CardDescription>
                Selecione o paciente e o período para listar as sessões realizadas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Paciente</Label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Switch 
                      checked={showInactive} 
                      onCheckedChange={setShowInactive} 
                      id="show-inactive"
                    />
                    <Label htmlFor="show-inactive" className="cursor-pointer text-xs font-normal">Mostrar inativos</Label>
                  </div>
                </div>
                <ClientSelector
                  clients={filteredClients}
                  value={selectedClientId}
                  onChange={setSelectedClientId}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Inicial</Label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Final</Label>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedClientId && (
            <Card>
              <CardHeader>
                <CardTitle>Atividades do Período</CardTitle>
                <CardDescription>
                  Selecione o que deseja incluir neste recibo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : activities.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma atividade encontrada neste período.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="border rounded-md divide-y">
                      {activities.map((item) => (
                        <div key={item.id} className="p-3 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start gap-3">
                            <Checkbox 
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={() => toggleItem(item.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-1">
                              <div className="flex justify-between items-start">
                                <div className="font-medium text-sm">
                                  {item.date ? `${item.date} - ` : ''}
                                  {item.description}
                                </div>
                                <div className="font-semibold text-sm">
                                  {formatCurrency(item.amount)}
                                </div>
                              </div>
                              
                              {item.isPrePeriod && (
                                <div className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded w-fit">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Iniciado antes do período pesquisado</span>
                                </div>
                              )}

                              {item.isUnpaid && (
                                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2 py-1 rounded w-fit">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Nenhum pagamento quitado neste período</span>
                                </div>
                              )}

                              {item.subItems && item.subItems.length > 0 && (
                                <div className="pl-4 border-l-2 border-muted mt-2 space-y-1">
                                  {item.subItems.map((sub, idx) => (
                                    <div key={idx} className="text-xs text-muted-foreground flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                                      {sub.date} - {sub.description}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-end justify-between pt-4 border-t">
                      <div className="space-y-1">
                        <Label>Valor Total do Recibo (R$)</Label>
                        <Input 
                          type="number" 
                          step="0.01" 
                          value={manualTotal} 
                          onChange={(e) => setManualTotal(e.target.value)}
                          className="w-40 font-semibold"
                        />
                        <p className="text-xs text-muted-foreground">Pode ser editado manualmente</p>
                      </div>
                      <Button 
                        size="lg" 
                        onClick={handleGenerate} 
                        disabled={isGenerating || selectedItems.size === 0}
                      >
                        {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ReceiptIcon className="w-4 h-4 mr-2" />}
                        Gerar Recibo
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Lado Direito: Histórico */}
        {selectedClientId && (
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ReceiptIcon className="w-4 h-4" /> Histórico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {isLoadingHistory ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-4">
                    Nenhum recibo emitido.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {history.map((receipt) => (
                      <div key={receipt.id} className="p-3 border rounded-lg bg-muted/20 text-sm flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold">
                            {formatCurrency(receipt.total_amount)}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-primary"
                            onClick={() => handlePrintHistory(receipt)}
                            title="Imprimir"
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-col">
                          <span>Ref: {format(new Date(receipt.start_date), 'dd/MM/yy')} a {format(new Date(receipt.end_date), 'dd/MM/yy')}</span>
                          <span>Emitido: {format(new Date(receipt.created_at || ''), "dd/MM/yyyy 'às' HH:mm")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getTodayRecord,
  upsertTimeRecord,
  getTimeTrackingHistory,
} from '@/modules/time-tracking/service'
import { TimeRecord } from '@/shared/types'
import { useToast } from '@/shared/hooks/use-toast'
import { Clock, Loader2, Save, AlertCircle, History } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface TimeTrackerProps {
  professionalId: string
}

export const TimeTracker = ({ professionalId }: TimeTrackerProps) => {
  const [isLoading, setIsLoading] = useState(true)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [clockIn, setClockIn] = useState<string>('')
  const [clockOut, setClockOut] = useState<string>('')
  const [history, setHistory] = useState<TimeRecord[]>([])
  const { toast } = useToast()
  const [currentTime, setCurrentTime] = useState(new Date())

  // Generate 30-min interval times options starting from 06:00 to 23:30
  const timeOptions = Array.from({ length: 36 }, (_, i) => {
    const hours = 6 + Math.floor(i / 2)
    const minutes = i % 2 === 0 ? '00' : '30'
    return `${String(hours).padStart(2, '0')}:${minutes}`
  })

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (professionalId) {
      fetchStatus()
      fetchHistory()
    }
  }, [professionalId])

  const fetchStatus = async () => {
    setIsLoading(true)
    const { data } = await getTodayRecord(professionalId)
    if (data) {
      if (data.clock_in) setClockIn(data.clock_in.substring(0, 5)) // Remove seconds if present
      if (data.clock_out) setClockOut(data.clock_out.substring(0, 5))
    }
    setIsLoading(false)
  }

  const fetchHistory = async () => {
    setIsHistoryLoading(true)
    const { data } = await getTimeTrackingHistory(professionalId)
    setHistory(data || [])
    setIsHistoryLoading(false)
  }

  const handleSave = async () => {
    if (!clockIn) {
      toast({
        title: 'Horário de Entrada Obrigatório',
        description: 'Por favor, selecione um horário de entrada.',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    const today = format(new Date(), 'yyyy-MM-dd')
    const { error } = await upsertTimeRecord(
      professionalId,
      today,
      clockIn + ':00',
      clockOut ? clockOut + ':00' : null,
    )

    if (error) {
      console.error('Time record save error:', error)
      toast({
        title: 'Erro ao salvar registro',
        description: 'Não foi possível salvar o ponto. Verifique sua conexão.',
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Registro Salvo',
        description: 'Seus horários foram atualizados com sucesso.',
      })
      fetchHistory() // Refresh history after save
    }
    setIsProcessing(false)
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-2">
        <div className="bg-primary/5 p-6 flex flex-col items-center justify-center border-b">
          <Clock className="w-12 h-12 text-primary mb-4" />
          <h2 className="text-4xl font-mono font-bold tracking-wider text-primary">
            {format(currentTime, 'HH:mm:ss')}
          </h2>
          <p className="text-muted-foreground mt-2 font-medium">
            {format(currentTime, "EEEE, dd 'de' MMMM 'de' yyyy", {
              locale: ptBR,
            })}
          </p>
        </div>

        <CardHeader>
          <CardTitle>Registro de Horas</CardTitle>
          <CardDescription>
            Selecione seus horários de entrada e saída (início às 06:00).
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Horário de Entrada
                </label>
                <Select value={clockIn} onValueChange={setClockIn}>
                  <SelectTrigger className="h-12 text-lg">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {timeOptions.map((time) => (
                      <SelectItem key={`in-${time}`} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Horário de Saída</label>
                <Select value={clockOut} onValueChange={setClockOut}>
                  <SelectTrigger className="h-12 text-lg">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {timeOptions.map((time) => (
                      <SelectItem key={`out-${time}`} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 pt-4">
                <Button
                  size="lg"
                  className="w-full h-12 text-lg"
                  onClick={handleSave}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-6 w-6" />
                  )}
                  Salvar Registro
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground border">
        <p className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          Mantenha seu registro atualizado diariamente. Você pode ajustar os
          horários a qualquer momento durante o dia.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Registros Anteriores
          </CardTitle>
          <CardDescription>Seus últimos registros de ponto.</CardDescription>
        </CardHeader>
        <CardContent>
          {isHistoryLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhum registro encontrado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Saída</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium capitalize">
                      {format(
                        parseISO(`${record.date}T00:00:00`),
                        'EEE, dd/MM/yyyy',
                        {
                          locale: ptBR,
                        },
                      )}
                    </TableCell>
                    <TableCell>{record.clock_in}</TableCell>
                    <TableCell>{record.clock_out || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getGlobalBlockedDates,
  addGlobalBlockedDate,
  deleteGlobalBlockedDate,
} from '../service'
import { getAppointmentsForRange } from '../../appointments/service'
import { BlockedDate, Appointment } from '@/shared/types'
import { format, parseISO, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Trash2, Calendar as CalendarIcon, AlertCircle, Loader2, Globe } from 'lucide-react'
import { useToast } from '@/shared/hooks/use-toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAuth } from '@/shared/providers/AuthProvider'

export const GlobalBlockedDatesManager = () => {
  const { companyId, loading } = useAuth()
  const { toast } = useToast()
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [reason, setReason] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingImpact, setIsCheckingImpact] = useState(false)
  const [affectedAppointments, setAffectedAppointments] = useState<Appointment[]>([])

  const NATIONAL_HOLIDAYS = [
    { date: '01-01', reason: 'Confraternização Universal (Ano Novo)' },
    { date: '04-21', reason: 'Tiradentes' },
    { date: '05-01', reason: 'Dia do Trabalho' },
    { date: '09-07', reason: 'Independência do Brasil' },
    { date: '10-12', reason: 'Nossa Senhora Aparecida' },
    { date: '11-02', reason: 'Finados' },
    { date: '11-15', reason: 'Proclamação da República' },
    { date: '11-20', reason: 'Dia da Consciência Negra' },
    { date: '12-25', reason: 'Natal' },
  ]

  const fetchBlockedDates = async () => {
    setIsLoading(true)
    const { data, error } = await getGlobalBlockedDates()
    if (data) setBlockedDates(data)
    if (error) {
      toast({
        title: 'Erro ao carregar bloqueios',
        description: 'Não foi possível carregar as datas bloqueadas.',
        variant: 'destructive',
      })
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (!loading && companyId) {
      fetchBlockedDates()
    }
  }, [loading, companyId])

  // Check impact whenever date changes
  useEffect(() => {
    const checkImpact = async () => {
      if (!selectedDate) {
        setAffectedAppointments([])
        return
      }

      setIsCheckingImpact(true)
      const start = startOfDay(selectedDate)
      const end = endOfDay(selectedDate)
      
      const { data, error } = await getAppointmentsForRange(start, end)
      if (data) {
        // Filter out cancelled appointments
        const active = data.filter(a => a.status !== 'cancelled')
        setAffectedAppointments(active)
      }
      setIsCheckingImpact(false)
    }

    if (!loading && companyId) {
      checkImpact()
    }
  }, [selectedDate, loading, companyId])

  const handleAddBlockedDate = async () => {
    if (!selectedDate) return

    setIsLoading(true)
    const dateStr = isRecurring 
      ? format(selectedDate, 'MM-dd')
      : format(selectedDate, 'yyyy-MM-dd')
    
    const type = isRecurring ? 'annual' : 'single'

    const { data, error } = await addGlobalBlockedDate(dateStr, type, reason || null)
    
    if (data) {
      toast({
        title: 'Data bloqueada',
        description: `${isRecurring ? 'Bloqueio anual' : 'Bloqueio único'} adicionado com sucesso.`,
      })
      setReason('')
      fetchBlockedDates()
    } else {
      toast({
        title: 'Erro ao bloquear data',
        description: error?.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      })
    }
    setIsLoading(false)
  }

  const handleImportHolidays = async () => {
    setIsLoading(true)
    let importedCount = 0

    // Filter out holidays already blocked
    const existingDates = new Set(blockedDates.filter(b => b.type === 'annual').map(b => b.date))
    const toImport = NATIONAL_HOLIDAYS.filter(h => !existingDates.has(h.date))

    if (toImport.length === 0) {
      toast({
        title: 'Feriados já importados',
        description: 'Todos os feriados nacionais já estão na sua lista de bloqueios.',
      })
      setIsLoading(false)
      return
    }

    try {
      const promises = toImport.map(h => addGlobalBlockedDate(h.date, 'annual', h.reason))
      await Promise.all(promises)
      
      toast({
        title: 'Feriados importados',
        description: `${toImport.length} feriados nacionais foram adicionados como bloqueios anuais.`,
      })
      fetchBlockedDates()
    } catch (error) {
      toast({
        title: 'Erro ao importar feriados',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await deleteGlobalBlockedDate(id)
    if (!error) {
      toast({
        title: 'Bloqueio removido',
        description: 'A data agora está disponível para agendamentos.',
      })
      fetchBlockedDates()
    } else {
      toast({
        title: 'Erro ao remover bloqueio',
        variant: 'destructive',
      })
    }
  }

  if (loading || !companyId) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Bloquear Nova Data</CardTitle>
          <CardDescription>
            Selecione uma data para bloquear novos agendamentos em toda a clínica.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center border rounded-md p-2">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ptBR}
              className="rounded-md"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Input
              id="reason"
              placeholder="Ex: Feriado, Reforma..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between space-x-2 border rounded-md p-3">
            <div className="space-y-0.5">
              <Label>Bloqueio Recorrente</Label>
              <p className="text-xs text-muted-foreground">Repetir todo ano nesta mesma data</p>
            </div>
            <Switch
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
          </div>

          {affectedAppointments.length > 0 && (
            <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Atenção: Pacientes Afetados</AlertTitle>
              <AlertDescription>
                Existem {affectedAppointments.length} agendamento(s) ativo(s) nesta data:
                <ul className="mt-2 text-xs list-disc list-inside">
                  {affectedAppointments.map(app => (
                    <li key={app.id}>
                      {app.clients?.name} - {app.professionals?.name} ({format(new Date(app.schedules?.start_time || ''), 'HH:mm')})
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-semibold">O bloqueio não cancelará estes agendamentos automaticamente.</p>
              </AlertDescription>
            </Alert>
          )}

          <Button 
            className="w-full" 
            onClick={handleAddBlockedDate}
            disabled={!selectedDate || isLoading || isCheckingImpact}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarIcon className="mr-2 h-4 w-4" />}
            Confirmar Bloqueio
          </Button>

          <Button 
            variant="outline"
            className="w-full" 
            onClick={handleImportHolidays}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
            Importar Feriados Nacionais
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datas Bloqueadas</CardTitle>
          <CardDescription>
            Lista de feriados e períodos de indisponibilidade global.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : blockedDates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhuma data bloqueada encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  blockedDates.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.type === 'annual' 
                          ? `${item.date.split('-')[1]}/${item.date.split('-')[0]} (Anual)`
                          : format(parseISO(item.date), 'dd/MM/yyyy')
                        }
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full ${item.type === 'annual' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                          {item.type === 'annual' ? 'Recorrente' : 'Único'}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {item.reason || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item.id)}
                          className="hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

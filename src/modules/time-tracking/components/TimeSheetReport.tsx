import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getAllProfessionals } from '@/shared/services'
import { getMonthlyTimeRecords } from '@/modules/time-tracking/service'
import { Professional, TimeRecord } from '@/shared/types'
import { format, parseISO, differenceInMinutes } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Printer, Search } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminTimeEntry } from './AdminTimeEntry'
import { useTenant } from '@/shared/contexts/TenantContext'

export const TimeSheetReport = () => {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [showInactives, setShowInactives] = useState(false)
  const [selectedProfessional, setSelectedProfessional] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>(
    String(new Date().getMonth() + 1),
  )
  const [selectedYear, setSelectedYear] = useState<string>(
    String(new Date().getFullYear()),
  )
  const [records, setRecords] = useState<TimeRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { config } = useTenant()
  const appName = config?.branding?.app_name || 'Sistema'

  useEffect(() => {
    getAllProfessionals().then(({ data }) => {
      if (data) setProfessionals(data)
    })
  }, [])

  const handleGenerate = async () => {
    if (!selectedProfessional) return
    setIsLoading(true)
    const { data } = await getMonthlyTimeRecords(
      selectedProfessional,
      parseInt(selectedYear),
      parseInt(selectedMonth),
    )
    setRecords(data || [])
    setIsLoading(false)
  }

  const calculateHours = (inTime: string, outTime: string | null) => {
    if (!outTime) return 0
    const d1 = parseISO(`2000-01-01T${inTime}`)
    const d2 = parseISO(`2000-01-01T${outTime}`)
    const diff = differenceInMinutes(d2, d1)
    return diff > 0 ? diff / 60 : 0
  }

  const formatHours = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h ${String(m).padStart(2, '0')}m`
  }

  const totalHours = records.reduce((acc, r) => {
    return acc + calculateHours(r.clock_in, r.clock_out)
  }, 0)

  const handlePrint = () => {
    window.print()
  }

  const professionalName =
    professionals.find((p) => p.id === selectedProfessional)?.name ||
    'Profissional'

  return (
    <div className="space-y-6 print:space-y-0 print:w-full">
      <div className="print:hidden">
        <AdminTimeEntry onSuccess={handleGenerate} />
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1.5">
              <CardTitle>Relatório de Ponto</CardTitle>
              <CardDescription>
                Gere relatórios de horas trabalhadas para a folha de pagamento.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-inactives"
                checked={showInactives}
                onCheckedChange={setShowInactives}
              />
              <label
                htmlFor="show-inactives"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Mostrar inativos
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Profissional</label>
              <Select
                value={selectedProfessional}
                onValueChange={setSelectedProfessional}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {professionals
                    .filter((p) => showInactives || p.is_active !== false)
                    .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mês</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {format(new Date(2000, i, 1), 'MMMM', { locale: ptBR })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ano</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={!selectedProfessional}>
              <Search className="mr-2 h-4 w-4" />
              Gerar Relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {(records.length > 0 || isLoading) && (
        <Card className="print:shadow-none print:border-none print:bg-white print:w-full">
          <CardHeader className="flex flex-row items-start justify-between print:px-0">
            <div className="print:text-black">
              <CardTitle className="text-2xl print:text-3xl font-bold text-primary print:text-black">
                Folha de Ponto
              </CardTitle>
              <CardDescription className="print:text-black print:text-lg">
                {professionalName} -{' '}
                <span className="capitalize">
                  {format(
                    new Date(
                      parseInt(selectedYear),
                      parseInt(selectedMonth) - 1,
                    ),
                    'MMMM yyyy',
                    { locale: ptBR },
                  )}
                </span>
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={handlePrint}
              className="print:hidden"
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </CardHeader>
          <CardContent className="print:px-0">
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : records.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum registro encontrado para este período.
              </div>
            ) : (
              <div className="space-y-6">
                <Table className="print:w-full">
                  <TableHeader>
                    <TableRow className="print:border-black">
                      <TableHead className="print:text-black font-bold">
                        Data
                      </TableHead>
                      <TableHead className="print:text-black font-bold">
                        Dia da Semana
                      </TableHead>
                      <TableHead className="print:text-black font-bold">
                        Entrada
                      </TableHead>
                      <TableHead className="print:text-black font-bold">
                        Saída
                      </TableHead>
                      <TableHead className="text-right print:text-black font-bold">
                        Horas Trabalhadas
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => {
                      const hours = calculateHours(
                        record.clock_in,
                        record.clock_out,
                      )
                      return (
                        <TableRow
                          key={record.id}
                          className="print:border-gray-300"
                        >
                          <TableCell className="print:text-black">
                            {format(
                              parseISO(`${record.date}T00:00:00`),
                              'dd/MM/yyyy',
                            )}
                          </TableCell>
                          <TableCell className="capitalize print:text-black">
                            {format(
                              parseISO(`${record.date}T00:00:00`),
                              'EEEE',
                              { locale: ptBR },
                            )}
                          </TableCell>
                          <TableCell className="print:text-black">
                            {record.clock_in}
                          </TableCell>
                          <TableCell className="print:text-black">
                            {record.clock_out || '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono print:text-black">
                            {formatHours(hours)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow className="bg-muted/50 font-bold print:bg-transparent print:border-black">
                      <TableCell
                        colSpan={4}
                        className="text-right print:text-black"
                      >
                        Total Mensal:
                      </TableCell>
                      <TableCell className="text-right print:text-black">
                        {formatHours(totalHours)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <div className="hidden print:block pt-16 mt-8 border-t print:border-transparent">
                  <div className="grid grid-cols-2 gap-12">
                    <div className="text-center border-t border-black pt-2">
                      <p className="font-bold text-black">{professionalName}</p>
                      <p className="text-sm text-black">Funcionário</p>
                    </div>
                    <div className="text-center border-t border-black pt-2">
                      <p className="font-bold text-black">{appName}</p>
                      <p className="text-sm text-black">Empregador</p>
                    </div>
                  </div>
                  <div className="mt-8 text-center text-xs text-gray-500">
                    <p>
                      Documento gerado eletronicamente em{' '}
                      {format(new Date(), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

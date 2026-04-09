import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getKpiMetrics,
  getServicePerformance,
  getPartnershipPerformance,
  getAnnualComparative,
} from '@/shared/services'
import {
  DollarSign,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  BarChart,
  Users,
  Handshake,
  Ticket,
  UserCheck,
} from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { startOfMonth } from 'date-fns'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import {
  BarChart as RechartsBarChart,
  Bar as RechartsBar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { cn } from '@/shared/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getAllProfessionals } from '@/shared/services'
import { getAllServices } from '@/shared/services'
import { getAllPartnerships } from '@/shared/services'
import { Professional, Service, Partnership } from '@/shared/types'

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const formatPercentage = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '0.0%'
  return `${value.toFixed(1)}%`
}

const KpiCard = ({
  title,
  value,
  comparison,
  icon: Icon,
  isLoading,
}: {
  title: string
  value: string | number
  comparison?: number
  icon: React.ElementType
  isLoading: boolean
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </>
      ) : (
        <>
          <div className="text-2xl font-bold">{value}</div>
          {comparison !== undefined && (
            <p
              className={cn(
                'text-xs text-muted-foreground flex items-center',
                comparison >= 0 ? 'text-green-600' : 'text-red-600',
              )}
            >
              {comparison >= 0 ? (
                <TrendingUp className="h-4 w-4 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 mr-1" />
              )}
              {comparison.toFixed(1)}% em relação ao período anterior
            </p>
          )}
        </>
      )}
    </CardContent>
  </Card>
)

const serviceChartConfig = {
  count: {
    label: 'Sessões',
    color: 'hsl(var(--primary))',
  },
  revenue: {
    label: 'Faturamento',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig

const partnershipChartConfig = {
  client_count: {
    label: 'Clientes',
    color: 'hsl(var(--chart-1))',
  },
  total_revenue: {
    label: 'Faturamento',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig

const annualChartConfig = {
  total_revenue: {
    label: 'Faturamento',
    color: 'hsl(var(--chart-1))',
  },
  total_appointments: {
    label: 'Sessões',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig

export const KpiDashboard = () => {
  const [serviceChartMetric, setServiceChartMetric] = useState<'count' | 'revenue'>('count')
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  })

  // Filters State
  const [selectedProfessional, setSelectedProfessional] = useState('all')
  const [selectedService, setSelectedService] = useState('all')
  const [selectedPartnership, setSelectedPartnership] = useState('all')

  // Lists State
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [partnerships, setPartnerships] = useState<Partnership[]>([])

  // Data State
  const [kpis, setKpis] = useState<any>(null)
  const [serviceData, setServiceData] = useState<any[]>([])
  const [partnershipData, setPartnershipData] = useState<any[]>([])
  const [annualData, setAnnualData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch filter options
  useEffect(() => {
    const fetchOptions = async () => {
      const [profRes, servRes, partRes] = await Promise.all([
        getAllProfessionals(),
        getAllServices(),
        getAllPartnerships(),
      ])
      if (profRes.data) setProfessionals(profRes.data)
      if (servRes.data) setServices(servRes.data)
      if (partRes.data) setPartnerships(partRes.data)
    }
    fetchOptions()
  }, [])

  useEffect(() => {
    const fetchKpis = async () => {
      if (!dateRange?.from || !dateRange?.to) return
      setIsLoading(true)

      const filters = {
        professionalId: selectedProfessional,
        serviceId: selectedService,
        partnershipId: selectedPartnership,
      }

      const [kpiRes, serviceRes, partnershipRes, annualRes] = await Promise.all(
        [
          getKpiMetrics(dateRange.from, dateRange.to, filters),
          getServicePerformance(dateRange.from, dateRange.to, filters),
          getPartnershipPerformance(dateRange.from, dateRange.to, filters),
          getAnnualComparative(filters),
        ],
      )

      setKpis(kpiRes.data)
      setServiceData(serviceRes.data || [])
      setPartnershipData(partnershipRes.data || [])
      setAnnualData(annualRes.data || [])
      setIsLoading(false)
    }
    fetchKpis()
  }, [dateRange, selectedProfessional, selectedService, selectedPartnership])

  const revenueComparison =
    kpis && kpis.prev_total_revenue > 0
      ? ((kpis.total_revenue - kpis.prev_total_revenue) /
          kpis.prev_total_revenue) *
        100
      : kpis?.total_revenue > 0
        ? 100
        : 0

  const appointmentsComparison =
    kpis && kpis.prev_completed_appointments > 0
      ? ((kpis.completed_appointments - kpis.prev_completed_appointments) /
          kpis.prev_completed_appointments) *
        100
      : kpis?.completed_appointments > 0
        ? 100
        : 0

  const ticketComparison =
    kpis && kpis.prev_average_ticket > 0
      ? ((kpis.average_ticket - kpis.prev_average_ticket) /
          kpis.prev_average_ticket) *
        100
      : kpis?.average_ticket > 0
        ? 100
        : 0

  const retentionComparison =
    kpis && kpis.prev_retention_rate > 0
      ? kpis.retention_rate - kpis.prev_retention_rate // Percentage point diff
      : 0

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-col xl:flex-row gap-4 items-end xl:items-center justify-between bg-muted/20 p-4 rounded-lg border">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          <Select
            value={selectedProfessional}
            onValueChange={setSelectedProfessional}
          >
            <SelectTrigger>
              <SelectValue placeholder="Profissional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Profissionais</SelectItem>
              {professionals.map((prof) => (
                <SelectItem key={prof.id} value={prof.id}>
                  {prof.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger>
              <SelectValue placeholder="Serviço" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Serviços</SelectItem>
              {services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedPartnership}
            onValueChange={setSelectedPartnership}
          >
            <SelectTrigger>
              <SelectValue placeholder="Parceria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Parcerias</SelectItem>
              {partnerships.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DateRangePicker
            date={dateRange}
            onDateChange={setDateRange}
            className="w-full"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="xl:col-span-2">
          <KpiCard
            title="Faturamento"
            value={formatCurrency(kpis?.total_revenue)}
            comparison={revenueComparison}
            icon={DollarSign}
            isLoading={isLoading}
          />
        </div>
        <div className="xl:col-span-2">
          <KpiCard
            title="Sessões Realizadas"
            value={kpis?.completed_appointments ?? 0}
            comparison={appointmentsComparison}
            icon={CalendarCheck}
            isLoading={isLoading}
          />
        </div>
        <div className="xl:col-span-2">
          <KpiCard
            title="Agendamentos Totais"
            value={kpis?.total_appointments ?? 0}
            icon={Users}
            isLoading={isLoading}
          />
        </div>

        <div className="xl:col-span-2">
          <KpiCard
            title="Ticket Médio"
            value={formatCurrency(kpis?.average_ticket)}
            comparison={ticketComparison}
            icon={Ticket}
            isLoading={isLoading}
          />
        </div>
        <div className="xl:col-span-2">
          <KpiCard
            title="Taxa de Retenção"
            value={formatPercentage(kpis?.retention_rate)}
            comparison={retentionComparison}
            icon={UserCheck}
            isLoading={isLoading}
          />
        </div>
        <div className="xl:col-span-2">
          <KpiCard
            title="Cancelamentos"
            value={formatPercentage(kpis?.cancellation_rate)}
            comparison={
              kpis
                ? kpis.cancellation_rate - kpis.prev_cancellation_rate
                : undefined
            }
            icon={TrendingDown}
            isLoading={isLoading}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" /> Desempenho dos Serviços
            </CardTitle>
            <Tabs value={serviceChartMetric} onValueChange={(val) => setServiceChartMetric(val as any)} className="w-[200px]">
              <TabsList className="grid w-full grid-cols-2 h-8">
                <TabsTrigger value="count" className="text-xs">Sessões</TabsTrigger>
                <TabsTrigger value="revenue" className="text-xs">Faturamento</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={serviceChartConfig}
              className="h-[300px] w-full"
            >
              {serviceData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Nenhum dado para o período selecionado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={serviceData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      type="category"
                      dataKey="service_name"
                      width={120}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    {serviceChartMetric === 'count' ? (
                      <RechartsBar
                        dataKey="count"
                        fill="var(--color-count)"
                        name="Sessões"
                        radius={[0, 4, 4, 0]}
                      />
                    ) : (
                      <RechartsBar
                        dataKey="revenue"
                        fill="var(--color-revenue)"
                        name="Faturamento"
                        radius={[0, 4, 4, 0]}
                      />
                    )}
                  </RechartsBarChart>
                </ResponsiveContainer>
              )}
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Handshake className="h-5 w-5" /> Desempenho das Parcerias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={partnershipChartConfig}
              className="h-[300px] w-full"
            >
              {partnershipData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Nenhum dado para o período selecionado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={partnershipData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="partnership_name"
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                    <Tooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <RechartsBar
                      yAxisId="left"
                      dataKey="client_count"
                      fill="var(--color-client_count)"
                      name="Clientes"
                      radius={[4, 4, 0, 0]}
                    />
                    <RechartsBar
                      yAxisId="right"
                      dataKey="total_revenue"
                      fill="var(--color-total_revenue)"
                      name="Faturamento"
                      radius={[4, 4, 0, 0]}
                    />
                  </RechartsBarChart>
                </ResponsiveContainer>
              )}
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Comparativo Anual (Últimos 12 Meses)</CardTitle>
        </CardHeader>
        <CardContent>
            <ChartContainer
              config={annualChartConfig}
              className="h-[400px] w-full"
            >
              {annualData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Nenhum dado para o período selecionado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={annualData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      type="monotone"
                      dataKey="total_revenue"
                      stroke="var(--color-total_revenue)"
                      name="Faturamento"
                      activeDot={{ r: 6, opacity: 0.8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total_appointments"
                      stroke="var(--color-total_appointments)"
                      name="Sessões"
                      activeDot={{ r: 6, opacity: 0.8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}

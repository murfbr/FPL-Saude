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
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  BarChart,
  Users,
  Handshake,
  Ticket,
} from 'lucide-react'
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  format as formatDate,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
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
  invertColors = false,
}: {
  title: string
  value: string | number
  comparison?: number
  icon: React.ElementType
  isLoading: boolean
  invertColors?: boolean
}) => {
  const isPositive = comparison && comparison > 0 ? true : false
  const colorClass =
    comparison === 0 || !comparison
      ? 'text-muted-foreground'
      : (isPositive && !invertColors) || (!isPositive && invertColors)
        ? 'text-green-600'
        : 'text-red-600'

  return (
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
              <p className={cn('text-xs flex items-center mt-1', colorClass)}>
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
}

const serviceChartConfig = {
  count: {
    label: 'Sessões',
    color: 'hsl(var(--primary))',
  },
  production_value: {
    label: 'Produção',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig

const partnershipChartConfig = {
  session_count: {
    label: 'Sessões',
    color: 'hsl(var(--chart-1))',
  },
  production_value: {
    label: 'Produção',
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
  const [serviceChartMetric, setServiceChartMetric] = useState<
    'count' | 'production'
  >('count')
  // O agregado é mensal: a navegação é por mês-calendário (range livre exige
  // breakdown diário — planejado para a evolução do módulo)
  const [currentMonth, setCurrentMonth] = useState(() =>
    startOfMonth(new Date()),
  )

  // Filters State
  const [selectedProfessional, setSelectedProfessional] = useState('all')
  const [selectedService, setSelectedService] = useState('all')
  const [selectedPartnership, setSelectedPartnership] = useState('all')

  const isFiltered =
    selectedProfessional !== 'all' ||
    selectedService !== 'all' ||
    selectedPartnership !== 'all'

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
        getAllProfessionals({ activeOnly: true }),
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
      setIsLoading(true)

      const filters = {
        professionalId: selectedProfessional,
        serviceId: selectedService,
        partnershipId: selectedPartnership,
      }

      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)
      const [kpiRes, serviceRes, partnershipRes, annualRes] = await Promise.all(
        [
          getKpiMetrics(monthStart, monthEnd, filters),
          getServicePerformance(monthStart, monthEnd, filters),
          getPartnershipPerformance(monthStart, monthEnd, filters),
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
  }, [currentMonth, selectedProfessional, selectedService, selectedPartnership])

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

  const productionComparison =
    kpis && kpis.prev_production_value > 0
      ? ((kpis.production_value - kpis.prev_production_value) /
          kpis.prev_production_value) *
        100
      : kpis?.production_value > 0
        ? 100
        : 0

  const totalAppointmentsComparison =
    kpis && kpis.prev_total_appointments > 0
      ? ((kpis.total_appointments - kpis.prev_total_appointments) /
          kpis.prev_total_appointments) *
        100
      : kpis?.total_appointments > 0
        ? 100
        : 0

  const tooltipFormatter = (value: any, name: any) => {
    if (
      name === 'Faturamento' ||
      name === 'Produção' ||
      name === 'revenue' ||
      name === 'total_revenue' ||
      name === 'production_value'
    ) {
      return formatCurrency(value as number)
    }
    return new Intl.NumberFormat('pt-BR').format(value as number)
  }

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

          <div className="flex items-center justify-between gap-1 bg-background border rounded-md px-1 h-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium capitalize whitespace-nowrap">
              {formatDate(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="xl:col-span-2">
          <KpiCard
            title={isFiltered ? 'Produção' : 'Faturamento'}
            value={formatCurrency(
              isFiltered ? kpis?.production_value : kpis?.total_revenue,
            )}
            comparison={isFiltered ? productionComparison : revenueComparison}
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
            title="Evolução de Agendamentos"
            value={kpis?.total_appointments ?? 0}
            comparison={totalAppointmentsComparison}
            icon={Users}
            isLoading={isLoading}
          />
        </div>

        <div className="xl:col-span-2">
          <KpiCard
            title={
              selectedProfessional !== 'all'
                ? 'Ticket Médio (Avulso)'
                : 'Ticket Médio'
            }
            value={formatCurrency(
              selectedProfessional !== 'all'
                ? kpis?.independent_sessions > 0
                  ? kpis.independent_revenue / kpis.independent_sessions
                  : 0
                : kpis?.average_ticket,
            )}
            comparison={
              selectedProfessional !== 'all' ? undefined : ticketComparison
            }
            icon={Ticket}
            isLoading={isLoading}
          />
        </div>
        <div className="xl:col-span-2">
          <KpiCard
            title="Cancelamentos / Faltas"
            value={formatPercentage(kpis?.cancellation_rate)}
            comparison={
              kpis
                ? kpis.cancellation_rate - kpis.prev_cancellation_rate
                : undefined
            }
            icon={TrendingDown}
            isLoading={isLoading}
            invertColors
          />
        </div>

        {selectedProfessional !== 'all' ? (
          <div className="xl:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Perfil de Atendimento
                </CardTitle>
                <BarChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2 mt-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : (
                  <div className="space-y-2 mt-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>{' '}
                        Pacotes
                      </span>
                      <span className="font-medium">
                        {kpis?.package_sessions || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>{' '}
                        Assinaturas
                      </span>
                      <span className="font-medium">
                        {kpis?.subscription_sessions || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>{' '}
                        Avulsos
                      </span>
                      <span className="font-medium">
                        {kpis?.independent_sessions || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-2 mt-2">
                      <span className="text-muted-foreground">
                        Faturamento Avulso
                      </span>
                      <span className="font-medium">
                        {formatCurrency(kpis?.independent_revenue)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="xl:col-span-2"></div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <BarChart className="h-5 w-5" /> Desempenho dos Serviços
            </CardTitle>
            <Tabs
              value={serviceChartMetric}
              onValueChange={(val) => setServiceChartMetric(val as any)}
              className="w-[180px] md:w-[200px]"
            >
              <TabsList className="grid w-full grid-cols-2 h-8">
                <TabsTrigger value="count" className="text-xs">
                  Sessões
                </TabsTrigger>
                <TabsTrigger value="production" className="text-xs">
                  Produção
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={serviceChartConfig}
              className="h-[350px] w-full"
            >
              {serviceData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Nenhum dado para o período selecionado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart
                    data={serviceData}
                    layout="vertical"
                    margin={{ left: 0, right: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={true}
                      vertical={false}
                    />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="service_name"
                      width={120}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) =>
                        value.length > 15
                          ? `${value.substring(0, 15)}...`
                          : value
                      }
                    />
                    <Tooltip
                      content={
                        <ChartTooltipContent formatter={tooltipFormatter} />
                      }
                    />
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
                        dataKey="production_value"
                        fill="var(--color-production_value)"
                        name="Produção"
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
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Handshake className="h-5 w-5" /> Desempenho das Parcerias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={partnershipChartConfig}
              className="h-[350px] w-full"
            >
              {partnershipData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Nenhum dado para o período selecionado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart
                    data={partnershipData}
                    layout="vertical"
                    margin={{ left: 0, right: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={true}
                      vertical={false}
                    />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="partnership_name"
                      width={120}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) =>
                        value.length > 15
                          ? `${value.substring(0, 15)}...`
                          : value
                      }
                    />
                    <Tooltip
                      content={
                        <ChartTooltipContent formatter={tooltipFormatter} />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <RechartsBar
                      dataKey="session_count"
                      fill="var(--color-session_count)"
                      name="Sessões"
                      radius={[0, 4, 4, 0]}
                    />
                    <RechartsBar
                      dataKey="production_value"
                      fill="var(--color-production_value)"
                      name="Produção"
                      radius={[0, 4, 4, 0]}
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
                <LineChart
                  data={annualData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      value >= 1000 ? `${value / 1000}k` : value
                    }
                  />
                  <Tooltip
                    content={
                      <ChartTooltipContent formatter={tooltipFormatter} />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line
                    type="monotone"
                    dataKey="total_revenue"
                    stroke="var(--color-total_revenue)"
                    name="Faturamento"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, opacity: 0.8 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total_appointments"
                    stroke="var(--color-total_appointments)"
                    name="Sessões"
                    strokeWidth={3}
                    dot={false}
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

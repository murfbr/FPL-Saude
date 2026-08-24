import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { getMultipleMonthlySummaries } from '@/modules/summaries/service'
import { useMonthlySummary } from '@/modules/financial/queries'
import { useAuth } from '@/shared/providers/AuthProvider'

const formatCurrency = (val: number | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    val || 0,
  )

const chartConfig = {
  entradas: { label: 'Entradas', color: 'hsl(var(--chart-1))' },
  saidas: { label: 'Saídas', color: 'hsl(var(--chart-2))' },
  saldo: { label: 'Saldo', color: 'hsl(var(--primary))' },
} satisfies ChartConfig

export const CashFlowTab = ({ month }: { month: Date }) => {
  const { companyId } = useAuth()
  const { data: summary, isLoading: summaryLoading } = useMonthlySummary(month)

  const monthKey = format(month, 'yyyy-MM')
  const { data: series = [], isLoading: seriesLoading } = useQuery({
    queryKey: ['summaries', 'cashflow-series', companyId, monthKey],
    queryFn: async () => {
      const months = Array.from({ length: 12 }, (_, i) =>
        startOfMonth(subMonths(month, 11 - i)),
      )
      const { data, error } = await getMultipleMonthlySummaries(months)
      if (error) throw error
      return data.map((s, i) => {
        const entradas = s.total_revenue || 0
        const saidas = s.total_expenses || 0
        return {
          month: format(months[i], 'MMM/yy', { locale: ptBR }),
          entradas,
          saidas,
          saldo: entradas - saidas,
        }
      })
    },
    staleTime: 5 * 60_000,
    enabled: !!companyId,
  })

  const entradas = summary?.total_revenue || 0
  const saidas = summary?.total_expenses || 0
  const saldo = entradas - saidas

  const categorias = useMemo(() => {
    const entries = Object.entries(summary?.expenses_by_category || {})
    return entries
      .map(([id, c]) => ({
        id,
        name: c.name || 'Sem categoria',
        total: c.total || 0,
      }))
      .filter((c) => c.total !== 0)
      .sort((a, b) => b.total - a.total)
  }, [summary])

  const isLoading = summaryLoading || seriesLoading

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Entradas do mês
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(entradas)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Avulsas + Assinaturas + Pacotes recebidos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saídas do mês</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(saidas)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Despesas pagas no mês
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo do mês</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div
                className={`text-2xl font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {formatCurrency(saldo)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Entradas − Saídas
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">
            Fluxo de Caixa — últimos 12 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[380px] w-full">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={series}
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
                      Math.abs(value) >= 1000 ? `${value / 1000}k` : `${value}`
                    }
                  />
                  <Tooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatCurrency(value as number)}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar
                    dataKey="entradas"
                    fill="var(--color-entradas)"
                    name="Entradas"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="saidas"
                    fill="var(--color-saidas)"
                    name="Saídas"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    stroke="var(--color-saldo)"
                    name="Saldo"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, opacity: 0.8 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">
            Saídas por categoria —{' '}
            {format(month, 'MMMM yyyy', { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : categorias.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma despesa paga neste mês.
            </p>
          ) : (
            <div className="space-y-3">
              {categorias.map((c) => {
                const pct = saidas > 0 ? (c.total / saidas) * 100 : 0
                return (
                  <div key={c.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{c.name}</span>
                      <span className="font-medium">
                        {formatCurrency(c.total)}{' '}
                        <span className="text-muted-foreground">
                          ({pct.toFixed(0)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

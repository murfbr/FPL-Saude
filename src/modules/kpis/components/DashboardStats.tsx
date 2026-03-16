import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Users, CalendarCheck } from 'lucide-react'

interface DashboardStatsProps {
  appointmentsToday: number
  totalClients: number
  monthlyRevenue: number
}

export const DashboardStats = ({
  appointmentsToday,
  totalClients,
  monthlyRevenue,
}: DashboardStatsProps) => {
  const formattedRevenue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(monthlyRevenue)

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Faturamento (Mês)
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formattedRevenue}</div>
          <p className="text-xs text-muted-foreground">+20.1% do último mês</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total de Clientes
          </CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">+{totalClients}</div>
          <p className="text-xs text-muted-foreground">
            Clientes ativos na plataforma
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sessões Hoje</CardTitle>
          <CalendarCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{appointmentsToday}</div>
          <p className="text-xs text-muted-foreground">
            Agendamentos para o dia de hoje
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

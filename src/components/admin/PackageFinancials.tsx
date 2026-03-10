import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getAllActiveClientPackages } from '@/services'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Ticket } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const PackageFinancials = () => {
  const [packages, setPackages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchPackages = async () => {
    setIsLoading(true)
    const { data } = await getAllActiveClientPackages()
    setPackages(data || [])
    setIsLoading(false)
  }

  useEffect(() => {
    fetchPackages()
  }, [])

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Ticket className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-medium">Controle de Pacotes Ativos</h3>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Pacote</TableHead>
              <TableHead>Data Compra</TableHead>
              <TableHead className="text-center">Sessões Totais</TableHead>
              <TableHead className="text-center">Utilizadas</TableHead>
              <TableHead className="text-center">Restantes</TableHead>
              <TableHead>Progresso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6">
                  Nenhum pacote ativo no momento.
                </TableCell>
              </TableRow>
            ) : (
              packages.map((pkg) => {
                const total = pkg.packages.session_count
                const remaining = pkg.sessions_remaining
                const used = total - remaining
                const progress = (used / total) * 100

                return (
                  <TableRow key={pkg.id}>
                    <TableCell className="font-medium">
                      {pkg.clients?.name}
                    </TableCell>
                    <TableCell>{pkg.packages.name}</TableCell>
                    <TableCell>
                      {format(new Date(pkg.purchase_date), 'dd/MM/yyyy', {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell className="text-center">{total}</TableCell>
                    <TableCell className="text-center">{used}</TableCell>
                    <TableCell className="text-center font-bold">
                      {remaining}
                    </TableCell>
                    <TableCell className="w-[200px]">
                      <Progress value={progress} className="h-2" />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

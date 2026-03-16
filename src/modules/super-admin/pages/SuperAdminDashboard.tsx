import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAllCompanies, getUsersByCompany } from '@/modules/super-admin/service'
import type { CompanyConfig } from '@/shared/types/tenant'

const SuperAdminDashboard = () => {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<CompanyConfig[]>([])
  const [userCounts, setUserCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      const { data } = await getAllCompanies()
      if (data) {
        setCompanies(data)
        // Fetch user counts for each company in parallel
        const counts = await Promise.all(
          data.map(async (c) => {
            const { data: users } = await getUsersByCompany(c.id)
            return [c.id, users?.length ?? 0] as [string, number]
          }),
        )
        setUserCounts(Object.fromEntries(counts))
      }
      setIsLoading(false)
    }
    load()
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Empresas
          </CardTitle>
          <Button onClick={() => navigate('/super-admin/companies/new')}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Nova Empresa
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Nenhuma empresa cadastrada. Crie a primeira!
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Usuários</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow
                  key={company.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/super-admin/companies/${company.id}`)}
                >
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {company.slug}
                  </TableCell>
                  <TableCell>
                    <Badge variant={company.is_active ? 'default' : 'secondary'}>
                      {company.is_active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {userCounts[company.id] ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export default SuperAdminDashboard

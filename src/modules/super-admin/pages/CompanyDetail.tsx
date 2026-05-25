import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useAuth } from '@/shared/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getCompanyConfig, setCompanyActive } from '@/modules/super-admin/service'
import type { CompanyConfig } from '@/shared/types/tenant'

import { ModulesTab } from '@/modules/super-admin/components/CompanyDetail/ModulesTab'
import { BrandingTab } from '@/modules/super-admin/components/CompanyDetail/BrandingTab'
import { RolesTab } from '@/modules/super-admin/components/CompanyDetail/RolesTab'
import { UsersTab } from '@/modules/super-admin/components/CompanyDetail/UsersTab'

const CompanyDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { impersonateCompany } = useAuth()
  const [company, setCompany] = useState<CompanyConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setIsLoading(true)
      const { data } = await getCompanyConfig(id)
      setCompany(data)
      setIsLoading(false)
    }
    load()
  }, [id])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (!company) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Empresa não encontrada.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/super-admin')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-xl font-bold">{company.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">{company.slug}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant={company.is_active ? 'default' : 'secondary'}>
            {company.is_active ? 'Ativa' : 'Inativa'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              impersonateCompany(company.id)
              navigate('/admin')
            }}
            className="flex items-center gap-2 border-primary/50 hover:bg-primary/5"
          >
            <ExternalLink className="h-4 w-4" />
            Entrar no App
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const { error } = await setCompanyActive(company.id, !company.is_active)
              if (!error) setCompany({ ...company, is_active: !company.is_active })
            }}
          >
            {company.is_active ? 'Desativar' : 'Ativar'}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="modules" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
              {['modules', 'branding', 'roles', 'users'].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
                >
                  {{ modules: 'Módulos', branding: 'Branding', roles: 'Matriz de Permissões', users: 'Usuários' }[tab]}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="p-6">
              <TabsContent value="modules">
                <ModulesTab company={company} onUpdate={setCompany} />
              </TabsContent>
              <TabsContent value="branding">
                <BrandingTab company={company} onUpdate={setCompany} />
              </TabsContent>
              <TabsContent value="roles">
                <RolesTab company={company} onUpdate={setCompany} />
              </TabsContent>
              <TabsContent value="users">
                <UsersTab company={company} />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export default CompanyDetail

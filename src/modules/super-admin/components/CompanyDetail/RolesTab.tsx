import { useState } from 'react'
import { Trash2, PlusCircle, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { updateCompanyRoles } from '@/modules/super-admin/service'
import { MODULE_REGISTRY } from '@/modules/registry'
import { ROLE_FEATURE_DEFINITIONS, type CompanyConfig, type RoleFeatureKey } from '@/shared/types/tenant'

export const RolesTab = ({
  company,
  onUpdate,
}: {
  company: CompanyConfig
  onUpdate: (c: CompanyConfig) => void
}) => {
  const { toast } = useToast()
  const [roles, setRoles] = useState<CompanyConfig['roles']>({ ...company.roles })
  const [newRoleName, setNewRoleName] = useState('')
  const [saving, setSaving] = useState(false)

  const modules = MODULE_REGISTRY.map((m) => m.key)

  const toggleModulePermission = (role: string, type: 'can_view' | 'can_edit', module: string) => {
    const current = roles[role][type]
    const isAll = current.includes('*')
    if (isAll) return
    const updated = current.includes(module)
      ? current.filter((m) => m !== module)
      : [...current, module]
    setRoles((prev) => ({
      ...prev,
      [role]: { ...prev[role], [type]: updated },
    }))
  }

  const toggleFeaturePermission = (role: string, featureKey: RoleFeatureKey) => {
    const currentFeatures = roles[role].features || []
    if (role === 'admin') return

    const updated = currentFeatures.includes(featureKey)
      ? currentFeatures.filter((f) => f !== featureKey)
      : [...currentFeatures, featureKey]
    
    setRoles((prev) => ({
      ...prev,
      [role]: { ...prev[role], features: updated },
    }))
  }

  const addRole = () => {
    const key = newRoleName.trim().toLowerCase().replace(/\s+/g, '_')
    if (!key || roles[key]) return
    setRoles((prev) => ({ ...prev, [key]: { can_view: [], can_edit: [], features: [] } }))
    setNewRoleName('')
  }

  const removeRole = (role: string) => {
    if (['admin', 'professional', 'client'].includes(role)) return
    if (!confirm(`Tem certeza que deseja remover a função ${role}?`)) return
    setRoles((prev) => {
      const next = { ...prev }
      delete next[role]
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    const { error } = await updateCompanyRoles(company.id, roles)
    setSaving(false)
    if (error) {
      toast({ title: 'Erro ao salvar funções', variant: 'destructive' })
    } else {
      onUpdate({ ...company, roles })
      toast({ title: 'Funções salvas!' })
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="modules" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="modules">Acesso a Módulos</TabsTrigger>
          <TabsTrigger value="features">Features Granulares</TabsTrigger>
        </TabsList>
        
        {/* MODULES PERMISSIONS SUB-TAB */}
        <TabsContent value="modules" className="pt-4">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[150px]">Função</TableHead>
                  {modules.map((m) => (
                    <TableHead key={m} className="text-center text-xs min-w-[140px] border-l px-4">
                      <div className="font-medium mb-2">{m}</div>
                      <div className="text-muted-foreground grid grid-cols-2 gap-2">
                        <span className="text-center" title="Pode Visualizar">Ver</span>
                        <span className="text-center" title="Pode Editar">Editar</span>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="w-[50px] border-l" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(roles).map(([roleName, perms]) => (
                  <TableRow key={`mod-${roleName}`}>
                    <TableCell className="font-medium font-mono text-sm border-r">{roleName}</TableCell>
                    {modules.map((m) => {
                      const isAllView = perms.can_view.includes('*')
                      const isAllEdit = perms.can_edit.includes('*')
                      return (
                        <TableCell key={m} className="text-center border-r p-0">
                          <div className="grid grid-cols-2 gap-2 h-full py-3 px-4">
                            <div className="flex justify-center">
                              <input
                                type="checkbox"
                                checked={isAllView || perms.can_view.includes(m)}
                                disabled={isAllView}
                                onChange={() => toggleModulePermission(roleName, 'can_view', m)}
                                className="w-4 h-4 cursor-pointer"
                              />
                            </div>
                            <div className="flex justify-center">
                              <input
                                type="checkbox"
                                checked={isAllEdit || perms.can_edit.includes(m)}
                                disabled={isAllEdit}
                                onChange={() => toggleModulePermission(roleName, 'can_edit', m)}
                                className="w-4 h-4 cursor-pointer"
                              />
                            </div>
                          </div>
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center">
                      {!['admin', 'professional', 'client'].includes(roleName) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => removeRole(roleName)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* FEATURE PERMISSIONS SUB-TAB */}
        <TabsContent value="features" className="pt-4">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[150px]">Função</TableHead>
                  {ROLE_FEATURE_DEFINITIONS.map((f) => (
                    <TableHead key={f.key} className="text-center text-xs min-w-[120px] border-l px-2" title={f.description}>
                      <div className="font-medium whitespace-pre-wrap">{f.label}</div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(roles).map(([roleName, perms]) => (
                  <TableRow key={`feat-${roleName}`}>
                    <TableCell className="font-medium font-mono text-sm border-r">
                      {roleName}
                    </TableCell>
                    {ROLE_FEATURE_DEFINITIONS.map((f) => {
                      const isAdmin = roleName === 'admin'
                      const hasFeature = isAdmin || (perms.features && perms.features.includes(f.key))
                      return (
                        <TableCell key={f.key} className="text-center border-r p-0">
                          <div className="flex justify-center items-center h-full py-3">
                            <input
                              type="checkbox"
                              checked={hasFeature}
                              disabled={isAdmin}
                              onChange={() => toggleFeaturePermission(roleName, f.key)}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </div>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ADD ROLE & SAVE */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex gap-2">
          <Input
            placeholder="Nova função (ex: secretaria)"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRole()}
            className="w-64"
          />
          <Button variant="outline" onClick={addRole}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Criar Função
          </Button>
        </div>
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar Matriz de Permissões'}
        </Button>
      </div>
    </div>
  )
}

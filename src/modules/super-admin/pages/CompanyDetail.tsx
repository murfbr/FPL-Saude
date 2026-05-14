import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Upload, Trash2, PlusCircle, UserPlus, ExternalLink } from 'lucide-react'
import { useAuth } from '@/shared/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { BrandingPreview } from '@/modules/super-admin/components/BrandingPreview'
import {
  getCompanyConfig,
  updateCompanyModules,
  updateCompanyBranding,
  updateCompanyRoles,
  updateCompanyFeatures,
  uploadCompanyLogo,
  getUsersByCompany,
  updateUserRole,
  createCompanyUser,
  deleteCompanyUser,
  setCompanyActive,
  type CompanyUser,
} from '@/modules/super-admin/service'
import { MODULE_REGISTRY } from '@/modules/registry'
import type { CompanyConfig, CompanyBranding } from '@/shared/types/tenant'

// ─── Modules Tab ─────────────────────────────────────────────────────────────

const ModulesTab = ({
  company,
  onUpdate,
}: {
  company: CompanyConfig
  onUpdate: (c: CompanyConfig) => void
}) => {
  const { toast } = useToast()
  const [saving, setSaving] = useState<string | null>(null)

  const handleToggle = async (key: string, enabled: boolean) => {
    setSaving(key)
    const updatedModules = {
      ...company.modules,
      [key]: { ...company.modules[key as keyof typeof company.modules], enabled },
    }
    const { error } = await updateCompanyModules(company.id, updatedModules)
    setSaving(null)
    if (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    } else {
      onUpdate({ ...company, modules: updatedModules })
    }
  }

  return (
    <div className="space-y-3 max-w-md">
      {MODULE_REGISTRY.map(({ key, label }) => {
        const mod = company.modules[key as keyof typeof company.modules]
        return (
          <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
            <span className="text-sm font-medium">{label}</span>
            <Switch
              checked={mod?.enabled ?? false}
              disabled={saving === key}
              onCheckedChange={(v) => handleToggle(key, v)}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Branding Tab ─────────────────────────────────────────────────────────────

const ColorField = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) => (
  <div className="flex items-center gap-3">
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-9 rounded border cursor-pointer"
    />
    <div className="flex-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-xs font-mono mt-0.5"
      />
    </div>
  </div>
)

const BrandingTab = ({
  company,
  onUpdate,
}: {
  company: CompanyConfig
  onUpdate: (c: CompanyConfig) => void
}) => {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [branding, setBranding] = useState<CompanyBranding>({ ...company.branding })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const update = (key: keyof CompanyBranding, value: string) => {
    setBranding((prev) => ({ ...prev, [key]: value }))
  }

  const handleLogoUpload = async (file: File) => {
    setUploading(true)
    const { url, error } = await uploadCompanyLogo(company.id, file)
    setUploading(false)
    if (error || !url) {
      toast({ title: 'Erro ao fazer upload do logo', variant: 'destructive' })
      return
    }
    setBranding((prev) => ({ ...prev, logo_url: url }))
    toast({ title: 'Logo enviado!' })
  }

  const handleSave = async () => {
    setSaving(true)
    const { error } = await updateCompanyBranding(company.id, branding)
    setSaving(false)
    if (error) {
      toast({ title: 'Erro ao salvar branding', variant: 'destructive' })
    } else {
      onUpdate({ ...company, branding })
      toast({ title: 'Branding salvo!' })
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Nome do App</Label>
          <Input value={branding.app_name} onChange={(e) => update('app_name', e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex items-center gap-2">
            <Input
              value={branding.logo_url}
              onChange={(e) => update('logo_url', e.target.value)}
              placeholder="URL da imagem ou use o upload"
              className="flex-1"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleLogoUpload(file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1" />
              {uploading ? 'Enviando...' : 'Upload'}
            </Button>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <Label className="text-sm font-semibold">Cores</Label>
          <ColorField label="Primária"    value={branding.primary_hex}    onChange={(v) => update('primary_hex', v)} />
          <ColorField label="Secundária"  value={branding.secondary_hex}  onChange={(v) => update('secondary_hex', v)} />
          <ColorField label="Destaque"    value={branding.accent_hex}     onChange={(v) => update('accent_hex', v)} />
          <ColorField label="Fundo"       value={branding.background_hex} onChange={(v) => update('background_hex', v)} />
          <ColorField label="Texto"       value={branding.foreground_hex} onChange={(v) => update('foreground_hex', v)} />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar Branding'}
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Pré-visualização</Label>
        <BrandingPreview branding={branding} />
      </div>
    </div>
  )
}

// ─── Roles Tab ───────────────────────────────────────────────────────────────

const RolesTab = ({
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

  const togglePermission = (role: string, type: 'can_view' | 'can_edit', module: string) => {
    const current = roles[role][type]
    const isAll = current.includes('*')
    if (isAll) return // wildcard roles handled separately
    const updated = current.includes(module)
      ? current.filter((m) => m !== module)
      : [...current, module]
    setRoles((prev) => ({
      ...prev,
      [role]: { ...prev[role], [type]: updated },
    }))
  }

  const addRole = () => {
    const key = newRoleName.trim().toLowerCase().replace(/\s+/g, '_')
    if (!key || roles[key]) return
    setRoles((prev) => ({ ...prev, [key]: { can_view: [], can_edit: [] } }))
    setNewRoleName('')
  }

  const removeRole = (role: string) => {
    if (['admin', 'professional', 'client'].includes(role)) return
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
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Função</TableHead>
              {modules.map((m) => (
                <TableHead key={m} className="text-center text-xs">
                  <div className="font-medium">{m}</div>
                  <div className="text-muted-foreground flex justify-center gap-1 mt-1">
                    <span>ver</span>
                    <span>editar</span>
                  </div>
                </TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(roles).map(([roleName, perms]) => (
              <TableRow key={roleName}>
                <TableCell className="font-medium font-mono text-sm">{roleName}</TableCell>
                {modules.map((m) => {
                  const isAllView = perms.can_view.includes('*')
                  const isAllEdit = perms.can_edit.includes('*')
                  return (
                    <TableCell key={m} className="text-center">
                      <div className="flex justify-center gap-2">
                        <input
                          type="checkbox"
                          checked={isAllView || perms.can_view.includes(m)}
                          disabled={isAllView}
                          onChange={() => togglePermission(roleName, 'can_view', m)}
                          title="Pode visualizar"
                        />
                        <input
                          type="checkbox"
                          checked={isAllEdit || perms.can_edit.includes(m)}
                          disabled={isAllEdit}
                          onChange={() => togglePermission(roleName, 'can_edit', m)}
                          title="Pode editar"
                        />
                      </div>
                    </TableCell>
                  )
                })}
                <TableCell>
                  {!['admin', 'professional', 'client'].includes(roleName) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
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

      <div className="flex gap-2">
        <Input
          placeholder="Nova função (ex: recepcionista)"
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addRole()}
          className="max-w-xs"
        />
        <Button variant="outline" onClick={addRole}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Adicionar Função
        </Button>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" />
        {saving ? 'Salvando...' : 'Salvar Funções'}
      </Button>
    </div>
  )
}

// ─── Users Tab ───────────────────────────────────────────────────────────────

const UsersTab = ({ company }: { company: CompanyConfig }) => {
  const { toast } = useToast()
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('professional')
  const [newPassword, setNewPassword] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      const { data } = await getUsersByCompany(company.id)
      if (data) setUsers(data)
      setIsLoading(false)
    }
    load()
  }, [company.id])

  const handleRoleChange = async (uid: string, role: string) => {
    const { error } = await updateUserRole(uid, role)
    if (error) {
      toast({ title: 'Erro ao alterar função', variant: 'destructive' })
    } else {
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role } : u)))
    }
  }

  const handleDeleteUser = async (uid: string) => {
    if (!confirm('Tem certeza que deseja remover este usuário?')) return
    const { error } = await deleteCompanyUser(uid)
    if (error) {
      toast({ title: 'Erro ao remover usuário', variant: 'destructive' })
    } else {
      setUsers((prev) => prev.filter((u) => u.uid !== uid))
      toast({ title: 'Usuário removido!' })
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    const { error } = await createCompanyUser(company.id, newName, newEmail, newRole, newPassword)
    setCreating(false)
    if (error) {
      toast({
        title: 'Erro ao criar usuário',
        description: String((error as any)?.message ?? error),
        variant: 'destructive',
      })
      return
    }
    toast({ 
      title: 'Usuário criado!', 
      description: newPassword ? 'Acesso liberado com a senha manual.' : 'E-mail de convite enviado.' 
    })
    setShowAddForm(false)
    setNewName('')
    setNewEmail('')
    setNewRole('professional')
    setNewPassword('')
    // Reload users
    const { data } = await getUsersByCompany(company.id)
    if (data) setUsers(data)
  }

  const roleOptions = Object.keys(company.roles)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowAddForm((v) => !v)} variant="outline">
          <UserPlus className="h-4 w-4 mr-2" />
          Adicionar Usuário
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Função</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Senha (opcional)</Label>
                <Input
                  type="password"
                  placeholder="Se vazio, envia e-mail"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={creating} className="sm:mt-0">
                {creating ? 'Criando...' : 'Criar'}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              Se você definir uma senha, o usuário poderá logar imediatamente. Caso contrário, ele receberá um e-mail.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Cadastrado em</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum usuário cadastrado nesta empresa.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.uid}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(v) => handleRoleChange(user.uid, v)}
                    >
                      <SelectTrigger className="h-7 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteUser(user.uid)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// ─── Features Tab ────────────────────────────────────────────────────────────

const FeaturesTab = ({
  company,
  onUpdate,
}: {
  company: CompanyConfig
  onUpdate: (c: CompanyConfig) => void
}) => {
  const { toast } = useToast()
  const [saving, setSaving] = useState<string | null>(null)

  const handleToggle = async (key: keyof CompanyConfig['features'], enabled: boolean) => {
    setSaving(key)
    const updatedFeatures = {
      ...(company.features || {}),
      [key]: enabled,
    }
    const { error } = await updateCompanyFeatures(company.id, updatedFeatures as any)
    setSaving(null)
    if (error) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    } else {
      onUpdate({ ...company, features: updatedFeatures as any })
    }
  }

  const featuresList = [
    {
      key: 'professionals_view_all_schedules',
      label: 'Permitir que profissionais vejam a agenda de outros profissionais',
      description: 'Se desmarcado, cada profissional só poderá ver e agendar nos próprios horários.',
    },
    {
      key: 'professionals_view_all_clients',
      label: 'Permitir que profissionais vejam a lista completa de pacientes',
      description: 'Se desmarcado, cada profissional só verá na lista os pacientes que já atendeu.',
    },
    {
      key: 'professionals_can_manage_packages',
      label: 'Permitir que profissionais gerenciem pacotes e assinaturas',
      description: 'Se desmarcado, o botão de associar pacotes ficará oculto no perfil do paciente para profissionais.',
    },
    {
      key: 'professionals_can_reschedule',
      label: 'Permitir que profissionais remarquem agendamentos',
      description: 'Se desmarcado, apenas administradores poderão reagendar.',
    },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      {featuresList.map(({ key, label, description }) => {
        const isEnabled = company.features?.[key as keyof typeof company.features] ?? false
        return (
          <div key={key} className="flex items-start justify-between py-2 border-b last:border-0 gap-4">
            <div className="flex-1 space-y-1">
              <span className="text-sm font-medium">{label}</span>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch
              checked={isEnabled}
              disabled={saving === key}
              onCheckedChange={(v) => handleToggle(key as keyof CompanyConfig['features'], v)}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── CompanyDetail (main) ─────────────────────────────────────────────────────

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
              {['modules', 'features', 'branding', 'roles', 'users'].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
                >
                  {{ modules: 'Módulos', features: 'Recursos', branding: 'Branding', roles: 'Funções', users: 'Usuários' }[tab]}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="p-6">
              <TabsContent value="modules">
                <ModulesTab company={company} onUpdate={setCompany} />
              </TabsContent>
              <TabsContent value="features">
                <FeaturesTab company={company} onUpdate={setCompany} />
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

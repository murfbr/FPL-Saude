import { useState, useEffect } from 'react'
import { UserPlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  getUsersByCompany,
  updateUserRole,
  createCompanyUser,
  deleteCompanyUser,
  type CompanyUser,
} from '@/modules/super-admin/service'
import type { CompanyConfig } from '@/shared/types/tenant'

export const UsersTab = ({ company }: { company: CompanyConfig }) => {
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

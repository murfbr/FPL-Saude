import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/shared/lib/firebase'
import { useToast } from '@/shared/hooks/use-toast'
import type { CompanyConfig, NavbarGroup } from '@/shared/types/tenant'
import { MODULE_REGISTRY } from '@/modules/registry'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, ChevronUp, ChevronDown, Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface NavbarTabProps {
  company: CompanyConfig
  onUpdate: (company: CompanyConfig) => void
}

// Opções derivadas do registry — uma única fonte de chaves de módulo
const AVAILABLE_MODULES = MODULE_REGISTRY.map((m) => ({ id: m.key, label: m.label }))

export function NavbarTab({ company, onUpdate }: NavbarTabProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  
  // Estado local para o builder
  const [groups, setGroups] = useState<NavbarGroup[]>(() => {
    return company.navbar_config ? JSON.parse(JSON.stringify(company.navbar_config)) : [
      { modules: ['appointments'] },
      { label: 'Gestão', modules: ['overview', 'kpi', 'financial', 'gallery'] },
      { label: 'Cadastros', modules: ['clients', 'professionals', 'partnerships'] },
      { label: 'Administrativo', modules: ['services', 'time_tracking', 'notifications', 'maintenance'] }
    ]
  })

  const addGroup = () => {
    setGroups([...groups, { label: '', modules: [] }])
  }

  const removeGroup = (index: number) => {
    const newGroups = [...groups]
    newGroups.splice(index, 1)
    setGroups(newGroups)
  }

  const moveGroup = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === groups.length - 1) return

    const newGroups = [...groups]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const temp = newGroups[index]
    newGroups[index] = newGroups[swapIndex]
    newGroups[swapIndex] = temp
    setGroups(newGroups)
  }

  const updateGroupLabel = (index: number, label: string) => {
    const newGroups = [...groups]
    newGroups[index].label = label
    if (label.trim() === '') {
      delete newGroups[index].label
    }
    setGroups(newGroups)
  }

  const toggleModuleInGroup = (groupIndex: number, moduleId: string) => {
    const newGroups = [...groups]
    const group = newGroups[groupIndex]
    const moduleIndex = group.modules.indexOf(moduleId as any)

    if (moduleIndex >= 0) {
      group.modules.splice(moduleIndex, 1) // Remove
    } else {
      group.modules.push(moduleId as any) // Add
    }
    setGroups(newGroups)
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      
      // Filtra grupos que não tem nenhum módulo (evitar salvar sujeira)
      const cleanGroups = groups.filter(g => g.modules && g.modules.length > 0)

      await updateDoc(doc(db, 'companies', company.id), {
        navbar_config: cleanGroups,
      })

      onUpdate({
        ...company,
        navbar_config: cleanGroups,
      })

      toast({
        title: 'Sucesso',
        description: 'Menu da Navbar configurado e atualizado na hora.',
      })
    } catch (error) {
      console.error('Error updating navbar:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Construtor do Menu (Navbar)</h3>
          <p className="text-sm text-muted-foreground">
            Monte a barra de navegação da empresa arrumando os módulos dentro de blocos. Se um bloco não tiver nome, seus botões ficarão soltos na raiz (Ex: Agenda).
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          <Save className="w-4 h-4" />
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>

      <div className="space-y-4">
        {groups.map((group, index) => (
          <Card key={index} className="relative overflow-hidden border-border/50 shadow-sm transition-all hover:border-border">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20"></div>
            <CardHeader className="py-4 flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex flex-col gap-2 w-full max-w-sm">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome do Agrupamento (Dropdown)</Label>
                <Input 
                  placeholder="Ex: Gestão (Deixe em branco para botões soltos)" 
                  value={group.label || ''}
                  onChange={(e) => updateGroupLabel(index, e.target.value)}
                  className="font-medium bg-background"
                />
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => moveGroup(index, 'up')} disabled={index === 0}>
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => moveGroup(index, 'down')} disabled={index === groups.length - 1}>
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => removeGroup(index)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 pb-4">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">Módulos Exibidos Neste Bloco</Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_MODULES.map(mod => {
                  const isSelected = group.modules.includes(mod.id as any)
                  return (
                    <Badge
                      key={mod.id}
                      variant={isSelected ? 'default' : 'outline'}
                      className={`cursor-pointer select-none transition-colors px-3 py-1.5 ${isSelected ? 'shadow-sm' : 'hover:bg-muted opacity-60'}`}
                      onClick={() => toggleModuleInGroup(index, mod.id)}
                    >
                      {mod.label}
                    </Badge>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        <Button variant="outline" className="w-full border-dashed py-8 mt-2 text-muted-foreground hover:text-foreground" onClick={addGroup}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Novo Bloco de Menu
        </Button>
      </div>
    </div>
  )
}

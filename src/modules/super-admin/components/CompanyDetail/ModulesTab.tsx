import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { updateCompanyModules } from '@/modules/super-admin/service'
import { MODULE_REGISTRY } from '@/modules/registry'
import type { CompanyConfig } from '@/shared/types/tenant'

export const ModulesTab = ({
  company,
  onUpdate,
}: {
  company: CompanyConfig
  onUpdate: (c: CompanyConfig) => void
}) => {
  const { toast } = useToast()
  const [localModules, setLocalModules] = useState(() => ({ ...company.modules }))
  const [saving, setSaving] = useState(false)

  const handleToggle = (key: string, enabled: boolean) => {
    setLocalModules((prev) => ({
      ...prev,
      [key]: { ...prev[key as keyof typeof prev], enabled },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    const { error } = await updateCompanyModules(company.id, localModules)
    setSaving(false)
    if (error) {
      toast({ title: 'Erro ao salvar módulos', variant: 'destructive' })
    } else {
      onUpdate({ ...company, modules: localModules })
      toast({ title: 'Módulos salvos com sucesso!' })
    }
  }

  // Verifica se houve alguma alteração em relação ao banco
  const hasChanges = JSON.stringify(localModules) !== JSON.stringify(company.modules)

  return (
    <div className="space-y-4 max-w-md">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Ative ou desative os módulos contratados por esta clínica.
        </p>
      </div>
      
      <div className="space-y-1 border rounded-md p-4 bg-card">
        {MODULE_REGISTRY.map(({ key, label }) => {
          const mod = localModules[key as keyof typeof localModules]
          return (
            <div key={key} className="flex items-center justify-between py-3 border-b last:border-0 border-border/50">
              <span className="text-sm font-medium">{label}</span>
              <Switch
                checked={mod?.enabled ?? false}
                onCheckedChange={(v) => handleToggle(key, v)}
              />
            </div>
          )
        })}
      </div>

      <Button onClick={handleSave} disabled={saving || !hasChanges} className="w-full">
        {saving ? 'Salvando...' : 'Salvar Alterações'}
      </Button>
    </div>
  )
}

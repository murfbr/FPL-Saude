import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
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

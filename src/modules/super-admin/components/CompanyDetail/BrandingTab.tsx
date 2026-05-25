import { useState, useRef } from 'react'
import { Upload, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { BrandingPreview } from '@/modules/super-admin/components/BrandingPreview'
import { updateCompanyBranding, uploadCompanyLogo } from '@/modules/super-admin/service'
import type { CompanyConfig, CompanyBranding } from '@/shared/types/tenant'

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

export const BrandingTab = ({
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

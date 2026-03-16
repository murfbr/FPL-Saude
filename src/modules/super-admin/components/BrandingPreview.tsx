import type { CompanyBranding } from '@/shared/types/tenant'

interface BrandingPreviewProps {
  branding: CompanyBranding
}

export const BrandingPreview = ({ branding }: BrandingPreviewProps) => {
  return (
    <div
      className="rounded-lg overflow-hidden border shadow-sm"
      style={{ background: branding.background_hex }}
    >
      {/* Mock header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: branding.primary_hex }}
      >
        {branding.logo_url ? (
          <img
            src={branding.logo_url}
            alt="logo"
            className="h-7 w-7 rounded object-cover"
          />
        ) : (
          <div
            className="h-7 w-7 rounded flex items-center justify-center text-xs font-bold"
            style={{
              background: branding.accent_hex,
              color: branding.primary_hex,
            }}
          >
            {branding.app_name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span
          className="font-semibold text-sm"
          style={{ color: branding.background_hex }}
        >
          {branding.app_name || 'Nome do App'}
        </span>
      </div>

      {/* Mock nav */}
      <div
        className="flex gap-1 px-4 py-2 border-b"
        style={{ borderColor: branding.secondary_hex + '40' }}
      >
        {['Início', 'Agenda', 'Pacientes'].map((label, i) => (
          <div
            key={label}
            className="px-3 py-1 rounded text-xs font-medium"
            style={{
              background: i === 0 ? branding.secondary_hex : 'transparent',
              color: i === 0 ? '#fff' : branding.foreground_hex,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Mock content */}
      <div className="p-4 space-y-2">
        <div
          className="h-2 rounded w-2/3"
          style={{ background: branding.foreground_hex + '20' }}
        />
        <div
          className="h-2 rounded w-1/2"
          style={{ background: branding.foreground_hex + '15' }}
        />
        <div
          className="mt-3 px-3 py-1.5 rounded text-xs font-medium w-fit"
          style={{
            background: branding.accent_hex,
            color: '#fff',
          }}
        >
          Ação Principal
        </div>
      </div>
    </div>
  )
}

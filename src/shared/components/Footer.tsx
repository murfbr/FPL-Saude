import { useTenant } from '@/shared/contexts/TenantContext'

export const Footer = () => {
  const currentYear = new Date().getFullYear()
  const { config } = useTenant()
  const appName = config?.branding?.app_name || 'Sistema'

  return (
    <footer className="border-t border-border/40 print:hidden">
      <div className="container flex h-14 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          &copy; {currentYear} {appName}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  )
}

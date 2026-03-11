import { Link, useLocation } from 'react-router-dom'
import { useIsMobile } from '@/hooks/use-mobile'
import { UserNav } from './header/UserNav'
import { MobileNav } from './header/MobileNav'
import { useAuth } from '@/providers/AuthProvider'
import { Skeleton } from './ui/skeleton'

export const Header = () => {
  const isMobile = useIsMobile()
  const { user, loading, role } = useAuth()
  const location = useLocation()

  // Determine if we are in an admin context for branding
  // This is used to display the "Dashboard Administrativo" in the header
  const isAdminContext =
    (role === 'admin' && location.pathname === '/') ||
    location.pathname.startsWith('/admin')

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 print:hidden">
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <img src="/logo.png" alt="FPL Saúde Logo" className="h-8 w-auto object-contain" />
          <span className="font-bold text-lg text-primary hidden sm:inline-block">FPL Saúde</span>
          {isAdminContext && (
            <>
              <span className="text-muted-foreground hidden sm:inline">|</span>
              <span className="text-sm md:text-lg text-muted-foreground font-medium truncate hidden sm:inline-block">
                Dashboard Administrativo
              </span>
            </>
          )}
        </Link>
        <nav>
          {loading ? (
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          ) : user ? (
            // Only render navigation if user is authenticated
            isMobile ? (
              <MobileNav />
            ) : (
              <UserNav />
            )
          ) : (
            // Fallback for safety
            <div className="w-8 h-8" />
          )}
        </nav>
      </div>
    </header>
  )
}

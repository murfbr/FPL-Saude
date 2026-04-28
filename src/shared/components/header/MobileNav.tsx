import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/shared/providers/AuthProvider'
import { useTenant } from '@/shared/contexts/TenantContext'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet'
import { LogOut, Briefcase, LayoutDashboard, Menu, X, Bell, ShieldHalf } from 'lucide-react'
import { NotificationBell } from './NotificationBell'

export const MobileNav = () => {
  const { user, signOut, role } = useAuth()
  const { config } = useTenant()
  const navigate = useNavigate()
  
  const appName = config?.branding?.app_name || 'Sistema'

  const handleSignOut = async () => {
    console.log('[AuthDebug] MobileNav: Triggering sign out...')
    await signOut()
    console.log(
      '[AuthDebug] MobileNav: Sign out complete, navigating to login.',
    )
    navigate('/login')
  }

  const handleNavigate = (path: string) => {
    navigate(path)
  }

  return (
    <div className="flex items-center gap-2">
      {user && role === 'professional' && <NotificationBell />}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:w-[340px]">
          <nav className="flex flex-col h-full">
            <div className="flex justify-between items-center border-b pb-4">
              <Link to="/" className="flex items-center space-x-2">
                <span className="font-bold text-lg text-primary">
                  {appName}
                </span>
              </Link>
              <SheetClose asChild>
                <Button variant="ghost" size="icon">
                  <X className="h-6 w-6" />
                </Button>
              </SheetClose>
            </div>
            <div className="flex-grow mt-6">
              {user ? (
                <div className="space-y-4">
                  <div className="px-2 py-2">
                    <p className="text-sm font-medium leading-none">
                      Logado como
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="px-2 text-sm font-semibold text-muted-foreground">
                      Navegar para
                    </h3>
                    {role === 'admin' && (
                      <SheetClose asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => handleNavigate('/')}
                        >
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          Dashboard Admin
                        </Button>
                      </SheetClose>
                    )}
                    {role === 'super_admin' && (
                      <SheetClose asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => handleNavigate('/super-admin')}
                        >
                          <ShieldHalf className="mr-2 h-4 w-4" />
                          Painel Super Admin
                        </Button>
                      </SheetClose>
                    )}
                    {(role === 'admin' || role === 'professional') && (
                      <SheetClose asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => handleNavigate('/profissional')}
                        >
                          <Briefcase className="mr-2 h-4 w-4" />
                          Área do Profissional
                        </Button>
                      </SheetClose>
                    )}
                    {role === 'professional' && (
                      <SheetClose asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() =>
                            handleNavigate('/profissional/notifications')
                          }
                        >
                          <Bell className="mr-2 h-4 w-4" />
                          Notificações
                        </Button>
                      </SheetClose>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      asChild
                    >
                      <Link to="/login">Entrar</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button className="w-full justify-start" asChild>
                      <Link to="/register">Cadastre-se</Link>
                    </Button>
                  </SheetClose>
                </div>
              )}
            </div>
            {user && (
              <div className="mt-auto border-t pt-4">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </Button>
              </div>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  )
}

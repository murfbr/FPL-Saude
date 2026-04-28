import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/shared/providers/AuthProvider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogOut, Briefcase, LayoutDashboard, Bell, ShieldHalf } from 'lucide-react'
import { NotificationBell } from './NotificationBell'

export const UserNav = () => {
  const { user, signOut, role } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    console.log('[AuthDebug] UserNav: Triggering sign out...')
    await signOut()
    console.log('[AuthDebug] UserNav: Sign out complete, navigating to login.')
    navigate('/login')
  }

  const getInitials = (name: string | null | undefined, email: string | null | undefined) => {
    if (name && name.trim().length > 0) {
      const parts = name.trim().split(/\s+/)
      if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      } else if (parts.length === 1 && parts[0].length >= 2) {
        return parts[0].substring(0, 2).toUpperCase()
      } else if (parts.length === 1) {
        return parts[0][0].toUpperCase()
      }
    }
    return email?.[0]?.toUpperCase() ?? 'U'
  }

  if (!user) {
    return (
      <div className="flex items-center space-x-2">
        <Button variant="ghost" asChild>
          <Link to="/login">Entrar</Link>
        </Button>
        <Button asChild>
          <Link to="/register">Cadastre-se</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {/* Show Notifications for both Professionals and Admins */}
      {(role === 'professional' || role === 'admin') && <NotificationBell />}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user.photoURL ?? undefined}
                alt={user.displayName || user.email || 'User'}
              />
              <AvatarFallback>{getInitials(user.displayName, user.email)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">Logado como</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Navegar para</DropdownMenuLabel>
          {role === 'admin' && (
            <DropdownMenuItem onClick={() => navigate('/admin')}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard Admin</span>
            </DropdownMenuItem>
          )}
          {role === 'super_admin' && (
            <DropdownMenuItem onClick={() => navigate('/super-admin')}>
              <ShieldHalf className="mr-2 h-4 w-4" />
              <span>Painel Super Admin</span>
            </DropdownMenuItem>
          )}
          {(role === 'admin' || role === 'professional') && (
            <DropdownMenuItem onClick={() => navigate('/profissional')}>
              <Briefcase className="mr-2 h-4 w-4" />
              <span>Área do Profissional</span>
            </DropdownMenuItem>
          )}
          {(role === 'professional' || role === 'admin') && (
            <DropdownMenuItem
              onClick={() => navigate('/profissional/notifications')}
            >
              <Bell className="mr-2 h-4 w-4" />
              <span>Notificações</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sair</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

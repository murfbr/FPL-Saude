import { Outlet, Link, useNavigate } from 'react-router-dom'
import { Shield, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/shared/providers/AuthProvider'

const SuperAdminLayout = () => {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between">
        <Link to="/super-admin" className="flex items-center gap-2 font-semibold text-lg">
          <Shield className="h-5 w-5 text-amber-400" />
          Super Admin
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:text-white hover:bg-slate-700"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </header>
      <main className="container mx-auto py-6 px-4">
        <Outlet />
      </main>
    </div>
  )
}

export default SuperAdminLayout

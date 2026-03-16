import { Navigate } from 'react-router-dom'
import { useAuth } from '@/shared/providers/AuthProvider'
import { Skeleton } from '@/components/ui/skeleton'

export const SuperAdminGuard = ({ children }: { children: React.ReactNode }) => {
  const { role, loading } = useAuth()

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (role !== 'super_admin') {
    return <Navigate to="/access-denied" replace />
  }

  return <>{children}</>
}

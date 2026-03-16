import { Outlet } from 'react-router-dom'
import { Header } from '@/shared/components/Header'
import { Footer } from '@/shared/components/Footer'
import { useAuth } from '@/shared/providers/AuthProvider'

export default function Layout() {
  const { user, loading } = useAuth()

  // Safety check: Layout should theoretically be protected by ProtectedRoute
  // but if it renders while loading or without user, we want to handle it gracefully.

  if (loading) {
    return null // ProtectedRoute handles the loading spinner
  }

  if (!user) {
    return null // ProtectedRoute handles redirect
  }

  return (
    <div className="flex flex-col min-h-screen bg-background font-sans text-foreground print:block print:h-auto print:overflow-visible print:bg-white">
      <Header />
      <main className="flex-grow print:h-auto print:overflow-visible">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

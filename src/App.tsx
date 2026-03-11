/* Main App Component - Handles routing (using react-router-dom), query client and other providers */
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/providers/AuthProvider'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { RoleGuard } from '@/components/RoleGuard'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Analytics } from '@vercel/analytics/react'
import Layout from './components/Layout'
import PublicLayout from './components/PublicLayout'
import Landing from './pages/Landing'
import Index from './pages/Index'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ProfessionalArea from './pages/ProfessionalArea'
import PatientDetail from './pages/admin/PatientDetail'
import Patients from './pages/admin/Patients'
import ProfessionalDetail from './pages/admin/ProfessionalDetail'
import NotFound from './pages/NotFound'
import ClientAreaUnavailable from './pages/ClientAreaUnavailable'
import AccessDenied from './pages/AccessDenied'
import ProfessionalPatientDetail from './pages/professional/PatientDetail'
import NotificationsPage from './pages/professional/Notifications'
import AdminDashboard from './pages/AdminDashboard'

console.log('App.tsx: Initializing application...')

// Helper component to clean up overlays on route change
const OverlayCleanup = () => {
  const location = useLocation()
  useEffect(() => {
    // Force cleanup of any pointer-events or overflow styles on the body
    // that might have persisted from a previous unmount/remount cycle
    // specially from Radix UI Dialogs/Sheets
    document.body.style.pointerEvents = ''
    document.body.style.overflow = ''
  }, [location.pathname])
  return null
}

const App = () => (
  <ErrorBoundary>
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Analytics />
      <OverlayCleanup />
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            {/* Landing Page */}
            <Route path="/" element={<Landing />} />

            {/* Public Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/cliente-indisponivel"
                element={<ClientAreaUnavailable />}
              />
              <Route path="/access-denied" element={<AccessDenied />} />
            </Route>

            {/* Protected Routes - Flattened structure using RoleGuard for inner routes */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* Dashboard Route (Internal Routing) */}
              <Route path="/dashboard" element={<Index />} />

              {/* Admin Routes - Using RoleGuard instead of nested ProtectedRoute */}
              <Route path="/admin">
                <Route
                  index
                  element={
                    <RoleGuard allowedRoles={['admin']}>
                      <AdminDashboard />
                    </RoleGuard>
                  }
                />
                <Route
                  path="pacientes"
                  element={
                    <RoleGuard allowedRoles={['admin']}>
                      <Patients />
                    </RoleGuard>
                  }
                />
                <Route
                  path="pacientes/:id"
                  element={
                    <RoleGuard allowedRoles={['admin']}>
                      <PatientDetail />
                    </RoleGuard>
                  }
                />
                <Route
                  path="profissionais/:id"
                  element={
                    <RoleGuard allowedRoles={['admin']}>
                      <ProfessionalDetail />
                    </RoleGuard>
                  }
                />
              </Route>

              {/* Professional Routes */}
              <Route path="/profissional">
                <Route
                  index
                  element={
                    <RoleGuard allowedRoles={['professional', 'admin']}>
                      <ProfessionalArea />
                    </RoleGuard>
                  }
                />
                <Route
                  path="pacientes/:id"
                  element={
                    <RoleGuard allowedRoles={['professional', 'admin']}>
                      <ProfessionalPatientDetail />
                    </RoleGuard>
                  }
                />
                <Route
                  path="notifications"
                  element={
                    <RoleGuard allowedRoles={['professional', 'admin']}>
                      <NotificationsPage />
                    </RoleGuard>
                  }
                />
              </Route>
            </Route>

            {/* Catch-all for 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
)

export default App

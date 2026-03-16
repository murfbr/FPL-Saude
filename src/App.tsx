/* Main App Component - Handles routing (using react-router-dom), query client and other providers */
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/shared/providers/AuthProvider'
import { TenantProvider } from '@/shared/providers/TenantProvider'
import { ProtectedRoute } from '@/shared/components/ProtectedRoute'
import { RoleGuard } from '@/shared/components/RoleGuard'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { Analytics } from '@vercel/analytics/react'
import Layout from '@/shared/components/Layout'
import PublicLayout from '@/shared/components/PublicLayout'
import Landing from '@/modules/landing/pages/Landing'
import Index from '@/shared/pages/Index'
import Login from '@/modules/auth/pages/Login'
import Register from '@/modules/auth/pages/Register'
import ForgotPassword from '@/modules/auth/pages/ForgotPassword'
import ResetPassword from '@/modules/auth/pages/ResetPassword'
import ProfessionalArea from '@/shared/pages/ProfessionalArea'
import PatientDetail from '@/modules/clients/pages/AdminPatientDetail'
import Patients from '@/modules/clients/pages/Patients'
import ProfessionalDetail from '@/modules/professionals/pages/ProfessionalDetail'
import NotFound from '@/shared/pages/NotFound'
import ClientAreaUnavailable from '@/shared/pages/ClientAreaUnavailable'
import AccessDenied from '@/shared/pages/AccessDenied'
import ProfessionalPatientDetail from '@/modules/clients/pages/ProfessionalPatientDetail'
import NotificationsPage from '@/modules/notifications/pages/Notifications'
import AdminDashboard from '@/shared/pages/AdminDashboard'
import SuperAdminLayout from '@/modules/super-admin/SuperAdminLayout'
import SuperAdminDashboard from '@/modules/super-admin/pages/SuperAdminDashboard'
import CompanyForm from '@/modules/super-admin/pages/CompanyForm'
import CompanyDetail from '@/modules/super-admin/pages/CompanyDetail'
import { SuperAdminGuard } from '@/modules/super-admin/SuperAdminGuard'

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
        <TenantProvider>
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

            {/* Super-Admin Routes */}
            <Route
              element={
                <ProtectedRoute>
                  <SuperAdminLayout />
                </ProtectedRoute>
              }
            >
              <Route
                path="/super-admin"
                element={
                  <SuperAdminGuard>
                    <SuperAdminDashboard />
                  </SuperAdminGuard>
                }
              />
              <Route
                path="/super-admin/companies/new"
                element={
                  <SuperAdminGuard>
                    <CompanyForm />
                  </SuperAdminGuard>
                }
              />
              <Route
                path="/super-admin/companies/:id"
                element={
                  <SuperAdminGuard>
                    <CompanyDetail />
                  </SuperAdminGuard>
                }
              />
            </Route>

            {/* Catch-all for 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
        </TenantProvider>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
)

export default App

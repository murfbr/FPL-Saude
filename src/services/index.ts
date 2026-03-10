import * as supabaseServices from './services'
import * as firebaseServices from './firebase/services'

import * as supabaseProfessionals from './professionals'
import * as firebaseProfessionals from './firebase/professionals'

import * as supabaseClients from './clients'
import * as firebaseClients from './firebase/clients'

import * as supabasePackages from './packages'
import * as firebasePackages from './firebase/packages'

import * as supabaseSubscriptionPlans from './subscription-plans'
import * as firebaseSubscriptionPlans from './firebase/subscription-plans'

import * as supabaseAppointments from './appointments'
import * as firebaseAppointments from './firebase/appointments'

import * as supabaseFinancials from './financials'
import * as firebaseFinancials from './firebase/financials'

import * as supabasePartnerships from './partnerships'
import * as firebasePartnerships from './firebase/partnerships'

import * as supabaseKpis from './kpis'
import * as firebaseKpis from './firebase/kpis'

// Feature Flag Router
const isFirebase = import.meta.env.VITE_DB_PROVIDER === 'firebase'
console.info(`[App Factory] Database Provider: ${isFirebase ? 'FIREBASE_SaaS' : 'SUPABASE_LEGACY'}`)

// -----------------------------------------------------
// 1. SERVICES
// -----------------------------------------------------
const ServicesAdapter = isFirebase ? firebaseServices : supabaseServices
export const {
  getServices,
  getAllServices,
  createService,
  updateService,
  deleteService
} = ServicesAdapter

// -----------------------------------------------------
// 2. PROFESSIONALS
// -----------------------------------------------------
const ProfessionalsAdapter = isFirebase ? firebaseProfessionals : supabaseProfessionals
export const {
  getProfessionalsByService,
  getAllProfessionals,
  getProfessionalById,
  updateProfessional,
  deleteProfessional,
  getServicesByProfessional,
  addServiceToProfessional,
  removeServiceFromProfessional,
  createProfessionalUser
} = ProfessionalsAdapter

// -----------------------------------------------------
// 3. CLIENTS
// -----------------------------------------------------
const ClientsAdapter = isFirebase ? firebaseClients : supabaseClients
export const {
  getClientsByProfessional,
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientPackages,
  getAllActiveClientPackages,
  assignPackageToClient,
  cancelClientPackage,
  getClientSubscriptions,
  createClientSubscription,
  updateClientSubscription,
  cancelClientSubscription,
  exportClientData,
  getClientsWithBirthdayThisWeek,
  getMonthlyClientUsage
} = ClientsAdapter

// -----------------------------------------------------
// 4. PACKAGES & SUBSCRIPTIONS
// -----------------------------------------------------
const PackagesAdapter = isFirebase ? firebasePackages : supabasePackages
export const {
  getPackages,
  createPackage,
  updatePackage,
  deletePackage
} = PackagesAdapter

const SubscriptionPlansAdapter = isFirebase ? firebaseSubscriptionPlans : supabaseSubscriptionPlans
export const {
  getSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan
} = SubscriptionPlansAdapter

// -----------------------------------------------------
// 5. APPOINTMENTS
// -----------------------------------------------------
const AppointmentsAdapter = isFirebase ? firebaseAppointments : supabaseAppointments
export const {
  bookAppointment,
  bookRecurringAppointments,
  rescheduleAppointment,
  updateAppointmentStatus,
  updateAppointment,
  deleteAppointment,
  getAppointmentsPaginated,
  getAppointmentsForRange,
  getAppointmentsByProfessional,
  getAppointmentsByProfessionalForRange,
  getAllAppointments,
  getUpcomingAppointments,
  getAppointmentsByClientId,
  // getCompletedAppointmentsCount, (Not implemented yet to avoid long file)
  // getFutureAppointmentsCount,
  addAppointmentNote,
  completeAppointment,
  markAppointmentAsNoShow,
  cancelAppointment,
  getAppointmentsByScheduleId
} = AppointmentsAdapter

// -----------------------------------------------------
// 6. FINANCIALS
// -----------------------------------------------------
const FinancialsAdapter = isFirebase ? firebaseFinancials : supabaseFinancials
export const {
  getInvoicedValue,
  getExpectedRevenue,
  getActiveSubscriptions,
  getSubscriptionPayments,
  paySubscription,
  deleteSubscriptionPayment
} = FinancialsAdapter

// -----------------------------------------------------
// 7. PARTNERSHIPS
// -----------------------------------------------------
const PartnershipsAdapter = isFirebase ? firebasePartnerships : supabasePartnerships
export const {
  getAllPartnerships,
  createPartnership,
  updatePartnership,
  deletePartnership,
  getDiscountsForPartnership,
  setPartnershipDiscounts
} = PartnershipsAdapter

// -----------------------------------------------------
// 8. KPIs e Dashboard
// -----------------------------------------------------
const KpisAdapter = isFirebase ? firebaseKpis : supabaseKpis
export const {
  getKpiMetrics,
  getServicePerformance,
  getPartnershipPerformance,
  getAnnualComparative
} = KpisAdapter





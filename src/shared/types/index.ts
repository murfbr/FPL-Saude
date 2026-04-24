export type UserRole = 'client' | 'professional' | 'admin'
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired'

export interface Service {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number
  value_type: 'session' | 'monthly'
  max_attendees: number
  requires_observation?: boolean
  packages?: Package[] | null
  subscription_plans?: SubscriptionPlan[] | null
}

export interface SubscriptionPlan {
  id: string
  name: string
  description: string | null
  service_id: string
  price: number
  sessions_per_week: number | null
  created_at: string
  is_active: boolean
}

export interface Professional {
  id: string
  user_id: string | null
  name: string
  specialty: string | null
  bio: string | null
  avatar_url: string | null
  is_active: boolean
  // Optional fields for dynamic availability checks
  current_occupancy?: number
  max_capacity?: number
  service_ids?: string[]
}

export interface Schedule {
  id?: string // Optional for dynamic slots
  professional_id: string
  start_time: string
  end_time: string
  current_count?: number
  max_capacity?: number
}

export interface Partnership {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface Client {
  id: string
  user_id?: string | null
  name: string
  email: string
  phone?: string | null
  partnership_id?: string | null
  is_active: boolean
  partnerships?: Partnership | null
  profile_picture_url?: string | null
  general_assessment?: Record<string, any> | null
  birth_date?: string | null
}

export interface NoteEntry {
  date: string
  professional_id?: string
  professional_name: string
  content: string
}

export interface Appointment {
  id: string
  client_id: string
  professional_id: string
  service_id: string
  schedule_id: string
  status: string
  discount_amount?: number
  notes: NoteEntry[] | null
  created_at: string
  is_recurring?: boolean
  recurrence_group_id?: string
  partnership_id?: string | null
  clients?: Partial<Client>
  professionals?: Partial<Professional>
  services?: Partial<Service>
  schedules?: Partial<Schedule>
}

export interface Package {
  id: string
  name: string
  description: string | null
  service_id: string | null
  session_count: number
  price: number
  is_active: boolean
  services?: Service | null
}

export interface ClientPackage {
  id: string
  client_id: string
  package_id: string
  purchase_date: string
  sessions_remaining: number
}

export interface ClientPackageWithDetails extends ClientPackage {
  packages: Package
}

export interface ClientSubscription {
  id: string
  client_id: string
  service_id: string
  subscription_plan_id?: string | null
  start_date: string
  end_date: string | null
  status: SubscriptionStatus
  amount?: number
  cancelled_at?: string | null
  discount_amount?: number
  created_at: string
  updated_at: string
  services?: Service
  subscription_plans?: SubscriptionPlan | null
  clients?: Client
  payment_status?: 'paid' | 'overdue' | 'pending' // UI helper field
  last_payment_date?: string | null // UI helper field
}

export interface FinancialRecord {
  id: string
  client_id: string
  professional_id: string
  appointment_id: string | null
  client_package_id: string | null
  client_subscription_id?: string | null
  amount: number
  payment_date: string
  description: string | null
}

export interface RecurringAvailability {
  id: string
  professional_id: string
  day_of_week: number
  start_time: string
  end_time: string
  created_at: string
  service_ids: string[] | null
}

export interface AvailabilityOverride {
  id: string
  professional_id: string
  override_date: string
  start_time: string
  end_time: string
  is_available: boolean
  created_at: string
  service_ids: string[] | null
}

export interface PartnershipDiscount {
  id: string
  partnership_id: string
  service_id: string | null
  discount_percentage: number
  created_at: string
}

export interface TimeRecord {
  id: string
  professional_id: string
  date: string
  clock_in: string
  clock_out: string | null
  created_at: string
}

export interface Notification {
  id: string
  professional_id: string
  title: string
  content: string
  is_read: boolean
  link: string | null
  created_at: string
}

export interface ClientExam {
  id: string
  client_id: string
  name: string
  type: 'exame' | 'laudo'
  file_url: string
  file_path: string
  created_at: string
  professional_id?: string
  professional_name?: string
}

export interface BlockedDate {
  id: string
  date: string // YYYY-MM-DD or MM-DD
  type: 'single' | 'annual'
  reason: string | null
  created_at: string
}

export * from './gallery'

export interface GalleryRecord {
  id: string
  client_id: string
  client_name?: string // Added for the Admin Global List
  procedure_name: string
  before_url?: string
  before_path?: string
  after_url?: string
  after_path?: string
  date: string
  description?: string
  created_at: string
  professional_id?: string
  professional_name?: string
}

import { db } from '@/shared/lib/firebase'
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, where, limit as fbLimit, arrayUnion, writeBatch, startAfter } from 'firebase/firestore'
import { Appointment, NoteEntry, Client, Professional, Service } from '@/shared/types'
import { getCompanyId } from '@/shared/lib/tenantStore'

async function hydrateAppointment(appDoc: any): Promise<Appointment> {
  const data = appDoc.data()
  const appointment = { id: appDoc.id, ...data } as any

  // Se já tiver os objetos básicos (denormalizados no write), não precisa de reads extras
  if (data.clients?.name && data.professionals?.name && data.services?.name) {
    return appointment as Appointment
  }

  // Fallback para documentos antigos (Legacy Hydration)
  const promises = []

  if (data.client_id && !data.clients) {
    promises.push(getDoc(doc(db, 'companies', getCompanyId(), 'clients', data.client_id)).then((d) => {
      appointment.clients = { id: d.id, name: d.data()?.name, email: d.data()?.email, phone: d.data()?.phone }
    }))
  }

  if (data.professional_id && !data.professionals) {
    promises.push(getDoc(doc(db, 'companies', getCompanyId(), 'professionals', data.professional_id)).then((d) => {
      appointment.professionals = { id: d.id, name: d.data()?.name }
    }))
  }

  if (data.service_id && !data.services) {
    promises.push(getDoc(doc(db, 'companies', getCompanyId(), 'services', data.service_id)).then((d) => {
      const s = d.data()
      appointment.services = {
        id: d.id,
        name: s?.name,
        duration_minutes: s?.duration_minutes,
        max_attendees: s?.max_attendees,
        value_type: s?.value_type,
        price: s?.price,
        requires_observation: s?.requires_observation !== false,
      }
    }))
  }

  if (promises.length > 0) await Promise.all(promises)
  return appointment as Appointment
}


export async function getAppointmentsPaginated(page: number, pageSize: number, filters: any): Promise<{ data: Appointment[] | null; count: number | null; error: any }> {
  try {
    // Paginação simples sem index composto gigante apenas para destravar UI em dev.
    const appointmentsRef = collection(db, 'companies', getCompanyId(), 'appointments')
    const qParts = []

    if (filters?.professionalId && filters.professionalId !== 'all') {
      qParts.push(where('professional_id', '==', filters.professionalId))
    }

    // Note: Em produção Firestore precisaria criar índice composto para Order + Where de campos diferentes.
    const q = query(appointmentsRef, ...qParts, fbLimit(pageSize))

    const snapshot = await getDocs(q)
    const promises = snapshot.docs.map(hydrateAppointment)
    const hydratedAppts = await Promise.all(promises)

    return { data: hydratedAppts, count: hydratedAppts.length, error: null }
  } catch (error) {
    return { data: null, count: null, error }
  }
}


export async function getAppointmentsForRange(startDate: Date, endDate: Date, professionalId?: string): Promise<{ data: Appointment[] | null; error: any }> {
  try {
    const appointmentsRef = collection(db, 'companies', getCompanyId(), 'appointments')
    const qParts: any[] = []

    if (professionalId && professionalId !== 'all') {
      qParts.push(where('professional_id', '==', professionalId))
    }

    // OTIMIZAÇÃO: Filtro de data no SERVER (Firestore)
    // Isso requer um Índice Composto: professional_id (ASC) + schedules.start_time (ASC)
    const startStr = startDate.toISOString()
    const endStr = endDate.toISOString()

    qParts.push(where('schedules.start_time', '>=', startStr))
    qParts.push(where('schedules.start_time', '<=', endStr))

    const q = query(appointmentsRef, ...qParts)
    const snapshot = await getDocs(q)

    const promises = snapshot.docs.map(hydrateAppointment)
    const hydratedAppts = await Promise.all(promises)

    return { data: hydratedAppts, error: null }
  } catch (error) { 
    console.error("Erro em getAppointmentsForRange:", error)
    return { data: null, error } 
  }
}


export async function getAppointmentsByProfessional(professionalId: string): Promise<{ data: Appointment[] | null; error: any }> {
  return getAllAppointments(professionalId)
}


export async function getAppointmentsByProfessionalForRange(professionalId: string, startDate: string, endDate: string): Promise<{ data: Appointment[] | null; error: any }> {
  return getAppointmentsForRange(new Date(startDate), new Date(endDate), professionalId)
}


export async function getAllAppointments(professionalId?: string): Promise<{ data: Appointment[] | null; error: any }> {
  try {
    const appointmentsRef = collection(db, 'companies', getCompanyId(), 'appointments')
    const qParts: any[] = []
    if (professionalId && professionalId !== 'all') qParts.push(where('professional_id', '==', professionalId))
    const q = query(appointmentsRef, ...qParts)
    const snapshot = await getDocs(q)
    const promises = snapshot.docs.map(hydrateAppointment)
    const hydratedAppts = await Promise.all(promises)
    return { data: hydratedAppts, error: null }
  } catch (error) { return { data: null, error } }
}


export async function getUpcomingAppointments(): Promise<{ data: Appointment[] | null; error: any }> {
  try {
    const appointmentsRef = collection(db, 'companies', getCompanyId(), 'appointments')
    const nowStr = new Date().toISOString()

    const q = query(
      appointmentsRef,
      where('schedules.start_time', '>=', nowStr),
      orderBy('schedules.start_time', 'asc'),
      fbLimit(20)
    )

    const snapshot = await getDocs(q)
    const promises = snapshot.docs.map(hydrateAppointment)
    const hydratedAppts = await Promise.all(promises)

    const filteredAppts = hydratedAppts.filter(a => a.status !== 'cancelled').slice(0, 5)

    return { data: filteredAppts, error: null }
  } catch (error) { return { data: null, error } }
}


export async function getAppointmentsByClientId(clientId: string): Promise<{ data: Appointment[] | null; error: any }> {
  try {
    const appointmentsRef = collection(db, 'companies', getCompanyId(), 'appointments')
    const q = query(appointmentsRef, where('client_id', '==', clientId))

    const snapshot = await getDocs(q)
    const promises = snapshot.docs.map(hydrateAppointment)
    const hydratedAppts = await Promise.all(promises)

    return { data: hydratedAppts, error: null }
  } catch (error) { return { data: null, error } }
}


export async function getAppointmentsByClientIdPaginated(
  clientId: string,
  limitCount: number = 15,
  lastDoc: any = null
): Promise<{ data: Appointment[] | null; lastVisible: any; hasMore: boolean; error: any }> {
  try {
    const appointmentsRef = collection(db, 'companies', getCompanyId(), 'appointments')
    let qParts = [
      where('client_id', '==', clientId),
      orderBy('schedules.start_time', 'desc'),
      fbLimit(limitCount)
    ]

    let q = query(appointmentsRef, ...qParts)

    if (lastDoc) {
      q = query(q, startAfter(lastDoc))
    }

    const snapshot = await getDocs(q)
    const promises = snapshot.docs.map(hydrateAppointment)
    const hydratedAppts = await Promise.all(promises)

    const lastVisible = snapshot.docs[snapshot.docs.length - 1]
    const hasMore = snapshot.docs.length === limitCount

    return { data: hydratedAppts, lastVisible, hasMore, error: null }
  } catch (error) {
    console.error("Error in getAppointmentsByClientIdPaginated:", error)
    return { data: null, lastVisible: null, hasMore: false, error }
  }
}


export async function getAppointmentsByScheduleId(scheduleId: string): Promise<{ data: Appointment[] | null; error: any }> {
  return { data: [], error: null }
}





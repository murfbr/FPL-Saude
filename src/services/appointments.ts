import { db } from '@/lib/firebase'
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, where, limit as fbLimit, arrayUnion, writeBatch } from 'firebase/firestore'
import { Appointment, NoteEntry, Client, Professional, Service } from '@/types'

const COMPANY_ID = 'fpl-saude'

/**
 * Função Auxiliar para "Hidratar" Agendamentos com os relacionamentos
 * que o React UI antigo espera do Supabase (ex: appointment.clients.name)
 */
async function hydrateAppointment(appDoc: any): Promise<Appointment> {
  const data = appDoc.data()
  const appointment = { id: appDoc.id, ...data } as any

  // Relacionamentos Paralelos em Memória
  const promises = []

  if (data.client_id) {
    promises.push(getDoc(doc(db, 'companies', COMPANY_ID, 'clients', data.client_id)).then((d) => {
      appointment.clients = { id: d.id, name: d.data()?.name, email: d.data()?.email, phone: d.data()?.phone }
    }))

  }

  if (data.professional_id) {
    promises.push(getDoc(doc(db, 'companies', COMPANY_ID, 'professionals', data.professional_id)).then((d) => {
      appointment.professionals = { id: d.id, name: d.data()?.name }
    }))
  }

  if (data.service_id) {
    promises.push(getDoc(doc(db, 'companies', COMPANY_ID, 'services', data.service_id)).then((d) => {
      const s = d.data()
      appointment.services = { id: d.id, name: s?.name, duration_minutes: s?.duration_minutes, max_attendees: s?.max_attendees, value_type: s?.value_type, price: s?.price }
    }))
  }

  // Se não existir data nativa no appointment e houver ID de Schedule antigo, tenta hidratar (Backward Compatibility Supabase)
  if (!data.schedules && data.schedule_id && data.professional_id) {
    promises.push(getDoc(doc(db, 'companies', COMPANY_ID, 'professionals', data.professional_id, 'availability', data.schedule_id)).then((d) => {
      if (d.exists() && d.data()) {
        const s = d.data()
        appointment.schedules = { start_time: s?.start_time, end_time: s?.end_time }
      }
    }).catch(() => { /* ignora se n existir no nosql */ }))
  }

  await Promise.all(promises)
  return appointment as Appointment
}

export async function bookAppointment(
  professionalId: string,
  clientId: string,
  serviceId: string,
  startTime: string,
  clientPackageId?: string,
  isRecurring: boolean = false,
  discountAmount: number = 0,
): Promise<{ data: { appointment_id: string } | null; error: any }> {
  try {
    const appointmentsRef = collection(db, 'companies', COMPANY_ID, 'appointments')
    const newDocRef = doc(appointmentsRef)

    // Mocking schedule shape for backward compatibility
    const appInfo = {
      id: newDocRef.id,
      professional_id: professionalId,
      client_id: clientId,
      service_id: serviceId,
      schedules: { start_time: startTime }, // Denormalized for NoSQL UI quick reads
      status: 'scheduled',
      created_at: new Date().toISOString(),
      client_package_id: clientPackageId || null,
      discount_amount: discountAmount,
    }

    await setDoc(newDocRef, appInfo)
    return { data: { appointment_id: newDocRef.id }, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function bookRecurringAppointments(
  professionalId: string, 
  clientId: string, 
  serviceId: string, 
  baseStartTime: string, 
  weeks: number,
  daysOfWeek: number[],
  clientPackageId?: string,
  discountAmount: number = 0
): Promise<{ error: any }> {
  try {
    if (!daysOfWeek || daysOfWeek.length === 0) {
      return { error: new Error('Nenhum dia da semana selecionado para recorrência.') }
    }

    const batch = writeBatch(db)
    const appointmentsRef = collection(db, 'companies', COMPANY_ID, 'appointments')
    const baseDate = new Date(baseStartTime)
    let appointmentsCreated = 0

    const recurrenceGroupId = crypto.randomUUID ? crypto.randomUUID() : `rec_${Date.now()}`

    for (const targetDay of daysOfWeek) {
      // Find the first occurrence of this weekday on or after the base date
      const firstOccurrence = new Date(baseDate)
      const currentDow = firstOccurrence.getDay()
      let daysToAdd = targetDay - currentDow
      if (daysToAdd < 0) {
         daysToAdd += 7
      }
      firstOccurrence.setDate(firstOccurrence.getDate() + daysToAdd)

      for (let w = 0; w < weeks; w++) {
        const occurrenceDate = new Date(firstOccurrence)
        occurrenceDate.setDate(occurrenceDate.getDate() + (w * 7))

        const newDocRef = doc(appointmentsRef)
        const appInfo = {
          id: newDocRef.id,
          professional_id: professionalId,
          client_id: clientId,
          service_id: serviceId,
          schedules: { start_time: occurrenceDate.toISOString() },
          status: 'scheduled',
          created_at: new Date().toISOString(),
          client_package_id: clientPackageId || null,
          discount_amount: discountAmount,
          is_recurring: true,
          recurrence_group_id: recurrenceGroupId
        }
        batch.set(newDocRef, appInfo)
        appointmentsCreated++
      }
    }
    
    if (appointmentsCreated > 0) {
       await batch.commit()
    }
    return { error: null }
  } catch (error) {
    console.error("Error creating recurring appointments:", error)
    return { error }
  }
}

export async function rescheduleAppointment(appointmentId: string, newProfessionalId: string, newStartTime: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'appointments', appointmentId)
    await updateDoc(docRef, { professional_id: newProfessionalId, 'schedules.start_time': newStartTime })
    return { error: null }
  } catch (error) { return { error } }
}

export async function updateAppointmentStatus(appointmentId: string, status: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'appointments', appointmentId)
    await updateDoc(docRef, { status })
    return { error: null }
  } catch (error) { return { error } }
}

export async function updateAppointment(appointmentId: string, updates: Partial<Appointment>): Promise<{ data: Appointment | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'appointments', appointmentId)
    await updateDoc(docRef, updates)
    return { data: null, error: null } // Simplified return
  } catch (error) { return { data: null, error } }
}

export async function deleteAppointment(appointmentId: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'appointments', appointmentId)
    await deleteDoc(docRef)
    return { error: null }
  } catch (error) { return { error } }
}

export async function getAppointmentsPaginated(page: number, pageSize: number, filters: any): Promise<{ data: Appointment[] | null; count: number | null; error: any }> {
  try {
    // Paginação simples sem index composto gigante apenas para destravar UI em dev.
    const appointmentsRef = collection(db, 'companies', COMPANY_ID, 'appointments')
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
    const appointmentsRef = collection(db, 'companies', COMPANY_ID, 'appointments')
    const qParts: any[] = []

    if (professionalId && professionalId !== 'all') {
      qParts.push(where('professional_id', '==', professionalId))
    }

    // Sem limites, buscamos a agenda e processamos local para não disparar 'missing index'
    const q = query(appointmentsRef, ...qParts)
    const snapshot = await getDocs(q)

    const startStr = startDate.toISOString()
    const endStr = endDate.toISOString()

    const filteredDocs = snapshot.docs.filter(d => {
      const data = d.data()
      // Se a data já vazou da query base, confere se tá no RANGE desejado do calendário
      if (!data.schedules?.start_time) return false
      return data.schedules.start_time >= startStr && data.schedules.start_time <= endStr
    })

    const promises = filteredDocs.map(hydrateAppointment)
    const hydratedAppts = await Promise.all(promises)

    return { data: hydratedAppts, error: null }
  } catch (error) { return { data: null, error } }
}

export async function getAppointmentsByProfessional(professionalId: string): Promise<{ data: Appointment[] | null; error: any }> {
  return getAllAppointments(professionalId)
}

export async function getAppointmentsByProfessionalForRange(professionalId: string, startDate: string, endDate: string): Promise<{ data: Appointment[] | null; error: any }> {
  return getAppointmentsForRange(new Date(startDate), new Date(endDate), professionalId)
}

export async function getAllAppointments(professionalId?: string): Promise<{ data: Appointment[] | null; error: any }> {
  try {
    const appointmentsRef = collection(db, 'companies', COMPANY_ID, 'appointments')
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
    const appointmentsRef = collection(db, 'companies', COMPANY_ID, 'appointments')
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
    const appointmentsRef = collection(db, 'companies', COMPANY_ID, 'appointments')
    const q = query(appointmentsRef, where('client_id', '==', clientId))

    const snapshot = await getDocs(q)
    const promises = snapshot.docs.map(hydrateAppointment)
    const hydratedAppts = await Promise.all(promises)

    return { data: hydratedAppts, error: null }
  } catch (error) { return { data: null, error } }
}

export async function completeAppointment(appointmentId: string): Promise<{ error: any }> {
  return updateAppointmentStatus(appointmentId, 'completed')
}

export async function markAppointmentAsNoShow(appointmentId: string): Promise<{ error: any }> {
  return updateAppointmentStatus(appointmentId, 'no_show')
}

export async function cancelAppointment(appointmentId: string): Promise<{ error: any }> {
  return updateAppointmentStatus(appointmentId, 'cancelled')
}

export async function addAppointmentNote(appointmentId: string, note: NoteEntry): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'appointments', appointmentId)
    // Usamos setDoc com merge: true para garantir que o array seja inicializado caso o agendamento antigo não o tenha.
    // Criamos um objeto sanitizado removendo chaves com valor 'undefined' pois o Firestore as rejeita
    const cleanNote = Object.fromEntries(Object.entries(note).filter(([_, v]) => v !== undefined))
    
    await setDoc(docRef, { 
      notes: arrayUnion(cleanNote) 
    }, { merge: true })
    return { error: null }
  } catch (e) { 
    console.error("Erro ao salvar anotação do paciente:", e)
    return { error: e } 
  }
}

export async function getAppointmentsByScheduleId(scheduleId: string): Promise<{ data: Appointment[] | null; error: any }> {
  return { data: [], error: null }
}

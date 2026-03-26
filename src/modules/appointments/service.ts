import { db } from '@/shared/lib/firebase'
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, where, limit as fbLimit, arrayUnion, writeBatch } from 'firebase/firestore'
import { Appointment, NoteEntry, Client, Professional, Service } from '@/shared/types'

import { getCompanyId } from '@/shared/lib/tenantStore'

/**
 * Função Auxiliar para "Hidratar" Agendamentos com os relacionamentos
 * que o React UI antigo espera do Supabase (ex: appointment.clients.name)
 */
/**
 * Função Auxiliar para "Hidratar" Agendamentos
 * Agora ela apenas retorna o agendamento se os campos denormalizados já existirem,
 * ou busca os dados se for um documento antigo (compatibilidade).
 */
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
      appointment.services = { id: d.id, name: s?.name, duration_minutes: s?.duration_minutes, max_attendees: s?.max_attendees, value_type: s?.value_type, price: s?.price }
    }))
  }

  if (promises.length > 0) await Promise.all(promises)
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
    const appointmentsRef = collection(db, 'companies', getCompanyId(), 'appointments')
    const newDocRef = doc(appointmentsRef)

    // OTIMIZAÇÃO: Buscar dados para desnormalizar no write
    const [clientSnap, profSnap, serviceSnap] = await Promise.all([
      getDoc(doc(db, 'companies', getCompanyId(), 'clients', clientId)),
      getDoc(doc(db, 'companies', getCompanyId(), 'professionals', professionalId)),
      getDoc(doc(db, 'companies', getCompanyId(), 'services', serviceId))
    ])

    const clientData = clientSnap.data()
    const profData = profSnap.data()
    const serviceData = serviceSnap.data()

    const appInfo = {
      id: newDocRef.id,
      professional_id: professionalId,
      client_id: clientId,
      service_id: serviceId,
      status: 'scheduled',
      created_at: new Date().toISOString(),
      client_package_id: clientPackageId || null,
      discount_amount: discountAmount,
      
      // Dados Desnormalizados
      clients: { 
        id: clientId, 
        name: clientData?.name, 
        email: clientData?.email, 
        phone: clientData?.phone 
      },
      professionals: { 
        id: professionalId, 
        name: profData?.name 
      },
      services: { 
        id: serviceId, 
        name: serviceData?.name, 
        duration_minutes: serviceData?.duration_minutes, 
        price: serviceData?.price,
        value_type: serviceData?.value_type
      },
      schedules: { 
        start_time: startTime,
        // Calculate end_time based on duration
        end_time: new Date(new Date(startTime).getTime() + (serviceData?.duration_minutes || 60) * 60000).toISOString()
      },
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
    const appointmentsRef = collection(db, 'companies', getCompanyId(), 'appointments')
    const baseDate = new Date(baseStartTime)
    let appointmentsCreated = 0

    const recurrenceGroupId = crypto.randomUUID ? crypto.randomUUID() : `rec_${Date.now()}`

    // OTIMIZAÇÃO: Buscar dados para desnormalizar no write
    const [clientSnap, profSnap, serviceSnap] = await Promise.all([
      getDoc(doc(db, 'companies', getCompanyId(), 'clients', clientId)),
      getDoc(doc(db, 'companies', getCompanyId(), 'professionals', professionalId)),
      getDoc(doc(db, 'companies', getCompanyId(), 'services', serviceId))
    ])

    const clientData = clientSnap.data()
    const profData = profSnap.data()
    const serviceData = serviceSnap.data()
    const duration = serviceData?.duration_minutes || 60

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
          status: 'scheduled',
          created_at: new Date().toISOString(),
          client_package_id: clientPackageId || null,
          discount_amount: discountAmount,
          is_recurring: true,
          recurrence_group_id: recurrenceGroupId,

          // Dados Desnormalizados
          clients: { id: clientId, name: clientData?.name, email: clientData?.email, phone: clientData?.phone },
          professionals: { id: professionalId, name: profData?.name },
          services: { 
            id: serviceId, 
            name: serviceData?.name, 
            duration_minutes: duration, 
            price: serviceData?.price,
            value_type: serviceData?.value_type
          },
          schedules: { 
            start_time: occurrenceDate.toISOString(),
            end_time: new Date(occurrenceDate.getTime() + duration * 60000).toISOString()
          },
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
    const docRef = doc(db, 'companies', getCompanyId(), 'appointments', appointmentId)
    
    // Get new professional info for denormalization
    let profName = undefined
    try {
      const profSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'professionals', newProfessionalId))
      profName = profSnap.data()?.name
    } catch(e) {}

    const appSnap = await getDoc(docRef)
    const appData = appSnap.data()
    const duration = appData?.services?.duration_minutes || 60
    
    const updates: any = { 
      professional_id: newProfessionalId, 
      'schedules.start_time': newStartTime,
      'schedules.end_time': new Date(new Date(newStartTime).getTime() + duration * 60000).toISOString()
    }

    if (profName) {
      updates['professionals.id'] = newProfessionalId
      updates['professionals.name'] = profName
    }

    await updateDoc(docRef, updates)
    return { error: null }
  } catch (error) { return { error } }
}

export async function rescheduleFutureAppointments(
  appointmentId: string,
  newProfessionalId: string,
  newStartTime: string
): Promise<{ error: any }> {
  try {
    const sourceDocRef = doc(db, 'companies', getCompanyId(), 'appointments', appointmentId)
    const sourceSnap = await getDoc(sourceDocRef)
    if (!sourceSnap.exists()) return { error: new Error('Agendamento não encontrado') }
    
    const sourceData = sourceSnap.data()
    const groupId = sourceData.recurrence_group_id
    
    // If not recurring, just do a normal reschedule
    if (!sourceData.is_recurring || !groupId) {
      return rescheduleAppointment(appointmentId, newProfessionalId, newStartTime)
    }

    // Get new professional info for denormalization
    let profName = undefined
    try {
      const profSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'professionals', newProfessionalId))
      profName = profSnap.data()?.name
    } catch(e) {}

    const appointmentsRef = collection(db, 'companies', getCompanyId(), 'appointments')
    const q = query(
      appointmentsRef,
      where('recurrence_group_id', '==', groupId),
      where('schedules.start_time', '>=', sourceData.schedules.start_time)
    )
    const snapshot = await getDocs(q)
    
    const batch = writeBatch(db)
    const newBaseDate = new Date(newStartTime)
    const oldBaseDate = new Date(sourceData.schedules.start_time)
    const diffMs = newBaseDate.getTime() - oldBaseDate.getTime()

    snapshot.docs.forEach(d => {
      const data = d.data()
      const oldStart = new Date(data.schedules.start_time)
      const newStart = new Date(oldStart.getTime() + diffMs)
      
      const duration = data.services?.duration_minutes || 60
      const newEnd = new Date(newStart.getTime() + duration * 60000)

      batch.update(d.ref, {
        professional_id: newProfessionalId,
        'professionals.id': newProfessionalId,
        'professionals.name': profName || data.professionals?.name,
        'schedules.start_time': newStart.toISOString(),
        'schedules.end_time': newEnd.toISOString()
      })
    })

    await batch.commit()
    return { error: null }
  } catch (error) {
    console.error("Error rescheduling future appointments:", error)
    return { error }
  }
}

export async function updateAppointmentStatus(appointmentId: string, status: string): Promise<{ error: any }> {
  try {
    const companyId = getCompanyId()
    const docRef = doc(db, 'companies', companyId, 'appointments', appointmentId)
    const appSnap = await getDoc(docRef)
    
    if (!appSnap.exists()) {
       return { error: new Error('Agendamento não encontrado') }
    }
    
    const appData = appSnap.data()
    const oldStatus = appData.status
    
    if (oldStatus === status) {
       return { error: null }
    }

    const isPackage = !!appData.client_package_id
    const isMonthlySubscription = appData.services?.value_type === 'monthly'
    const isAvulsa = !isPackage && !isMonthlySubscription

    // 1. Pacotes: Consumir ou estornar sessão
    if (isPackage) {
      const packageRef = doc(db, 'companies', companyId, 'clients', appData.client_id, 'packages', appData.client_package_id)
      
      const isConsumingStatus = status === 'completed' || status === 'no_show'
      const wasConsumingStatus = oldStatus === 'completed' || oldStatus === 'no_show'

      if (isConsumingStatus && !wasConsumingStatus) {
        // Consumir sessão
        const pkgSnap = await getDoc(packageRef)
        if (pkgSnap.exists()) {
           const pkgData = pkgSnap.data()
           const newRemaining = Math.max(0, (pkgData.sessions_remaining || 0) - 1)
           await updateDoc(packageRef, { sessions_remaining: newRemaining })
        }
      } else if (wasConsumingStatus && !isConsumingStatus) {
        // Estornar devolução da sessão
        const pkgSnap = await getDoc(packageRef)
        if (pkgSnap.exists()) {
           const pkgData = pkgSnap.data()
           const newRemaining = (pkgData.sessions_remaining || 0) + 1
           await updateDoc(packageRef, { sessions_remaining: newRemaining })
        }
      }
    }

    // 2. Avulsas: Criar ou remover registro financeiro
    if (isAvulsa) {
      const finRef = collection(db, 'companies', companyId, 'financial_records')
      
      if (status === 'completed' && oldStatus !== 'completed') {
        const price = appData.services?.price || 0
        const discount = appData.discount_amount || 0
        const finalPrice = Math.max(0, price - discount)
        
        if (finalPrice > 0) {
          const q = query(finRef, where('appointment_id', '==', appointmentId))
          const existingSnap = await getDocs(q)
          
          if (existingSnap.empty) {
            const newDoc = doc(finRef)
            await setDoc(newDoc, {
              id: newDoc.id,
              client_id: appData.client_id,
              professional_id: appData.professional_id,
              appointment_id: appointmentId,
              amount: finalPrice,
              payment_date: new Date().toISOString(),
              description: `Sessão Avulsa - ${appData.services?.name || 'Serviço'}`,
              payment_method: 'manual'
            })
          }
        }
      } else if (oldStatus === 'completed' && status !== 'completed') {
        const q = query(finRef, where('appointment_id', '==', appointmentId))
        const existingSnap = await getDocs(q)
        
        const deletePromises = existingSnap.docs.map(d => deleteDoc(d.ref))
        await Promise.all(deletePromises)
      }
    }

    // Atualiza o status do agendamento ao final
    await updateDoc(docRef, { status })
    return { error: null }
  } catch (error) { 
    console.error("Erro ao atualizar status do agendamento: ", error)
    return { error } 
  }
}

export async function updateAppointment(appointmentId: string, updates: Partial<Appointment>): Promise<{ data: Appointment | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'appointments', appointmentId)
    await updateDoc(docRef, updates)
    return { data: null, error: null } // Simplified return
  } catch (error) { return { data: null, error } }
}

export async function deleteAppointment(appointmentId: string): Promise<{ error: any }> {
  try {
    const companyId = getCompanyId()
    const docRef = doc(db, 'companies', companyId, 'appointments', appointmentId)
    
    // Processar devolução de sessão e/ou finanças
    const appSnap = await getDoc(docRef)
    if (appSnap.exists()) {
       const appData = appSnap.data()
       const isPackage = !!appData.client_package_id
       const isMonthlySubscription = appData.services?.value_type === 'monthly'
       const isAvulsa = !isPackage && !isMonthlySubscription
       const wasConsumingStatus = appData.status === 'completed' || appData.status === 'no_show'
       
       if (isPackage && wasConsumingStatus) {
         const packageRef = doc(db, 'companies', companyId, 'clients', appData.client_id, 'packages', appData.client_package_id)
         const pkgSnap = await getDoc(packageRef)
         if (pkgSnap.exists()) {
           const pkgData = pkgSnap.data()
           const newRemaining = (pkgData.sessions_remaining || 0) + 1
           await updateDoc(packageRef, { sessions_remaining: newRemaining })
         }
       }
       
       if (isAvulsa && appData.status === 'completed') {
         const finRef = collection(db, 'companies', companyId, 'financial_records')
         const q = query(finRef, where('appointment_id', '==', appointmentId))
         const existingSnap = await getDocs(q)
         const deletePromises = existingSnap.docs.map(d => deleteDoc(d.ref))
         await Promise.all(deletePromises)
       }
    }
    
    await deleteDoc(docRef)
    return { error: null }
  } catch (error) { return { error } }
}

export async function deleteFutureAppointments(appointmentId: string): Promise<{ error: any }> {
  try {
    const companyId = getCompanyId()
    const sourceDocRef = doc(db, 'companies', companyId, 'appointments', appointmentId)
    const sourceSnap = await getDoc(sourceDocRef)
    if (!sourceSnap.exists()) return { error: new Error('Agendamento não encontrado') }
    
    const sourceData = sourceSnap.data()
    const groupId = sourceData.recurrence_group_id
    
    // If not recurring, just do a normal delete
    if (!sourceData.is_recurring || !groupId) {
      return deleteAppointment(appointmentId)
    }

    const appointmentsRef = collection(db, 'companies', companyId, 'appointments')
    const q = query(
      appointmentsRef,
      where('recurrence_group_id', '==', groupId),
      where('schedules.start_time', '>=', sourceData.schedules.start_time)
    )
    const snapshot = await getDocs(q)
    
    const batch = writeBatch(db)
    
    const packageRefunds = new Map<string, number>()
    const finAppointmentsToDelete: string[] = []

    snapshot.docs.forEach(d => {
      const appData = d.data()
      const isPackage = !!appData.client_package_id
      const isMonthlySubscription = appData.services?.value_type === 'monthly'
      const isAvulsa = !isPackage && !isMonthlySubscription
      const wasConsumingStatus = appData.status === 'completed' || appData.status === 'no_show'
      
      if (isPackage && wasConsumingStatus) {
        const pkgPath = `companies/${companyId}/clients/${appData.client_id}/packages/${appData.client_package_id}`
        const currentRefunds = packageRefunds.get(pkgPath) || 0
        packageRefunds.set(pkgPath, currentRefunds + 1)
      }
      
      if (isAvulsa && appData.status === 'completed') {
        finAppointmentsToDelete.push(d.id)
      }

      batch.delete(d.ref)
    })
    
    // Aplicar devoluções de pacotes
    for (const [pkgPath, refundsCount] of packageRefunds.entries()) {
      const pkgRef = doc(db, pkgPath)
      const pkgSnap = await getDoc(pkgRef)
      if (pkgSnap.exists()) {
        const pkgData = pkgSnap.data()
        const newRemaining = (pkgData.sessions_remaining || 0) + refundsCount
        batch.update(pkgRef, { sessions_remaining: newRemaining })
      }
    }
    
    // Deletar registros financeiros associados
    if (finAppointmentsToDelete.length > 0) {
      const finRef = collection(db, 'companies', companyId, 'financial_records')
      // Pode processar em baterias de 30 para evitar erro de query "IN"
      const finQuery = query(finRef, where('appointment_id', 'in', finAppointmentsToDelete.slice(0, 30)))
      const finSnap = await getDocs(finQuery)
      finSnap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref)
      })
    }

    await batch.commit()
    return { error: null }
  } catch (error) {
    console.error("Error deleting future appointments:", error)
    return { error }
  }
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
    const docRef = doc(db, 'companies', getCompanyId(), 'appointments', appointmentId)
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

export async function getLastClientNotes(clientId: string, limit: number = 5): Promise<{ data: NoteEntry[] | null; hasMore: boolean; totalCount: number; error: any }> {
  try {
    const appointmentsRef = collection(db, 'companies', getCompanyId(), 'appointments')
    const q = query(
      appointmentsRef,
      where('client_id', '==', clientId),
      orderBy('schedules.start_time', 'desc')
    )
    const snapshot = await getDocs(q)
    
    let allNotes: NoteEntry[] = []
    snapshot.forEach(doc => {
      const data = doc.data()
      if (data.notes && Array.isArray(data.notes)) {
        allNotes.push(...data.notes)
      }
    })
    
    allNotes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    const totalCount = allNotes.length
    const hasMore = totalCount > limit
    const slicedNotes = allNotes.slice(0, limit)
    
    return { data: slicedNotes, hasMore, totalCount, error: null }
  } catch (error) {
    console.error("Error fetching last client notes:", error)
    return { data: null, hasMore: false, totalCount: 0, error }
  }
}

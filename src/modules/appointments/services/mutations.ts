import { db } from '@/shared/lib/firebase'
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, where, limit as fbLimit, arrayUnion, writeBatch, startAfter, increment } from 'firebase/firestore'
import { Appointment, NoteEntry, Client, ClientSubscription, Professional, Service } from '@/shared/types'
import { getCompanyId } from '@/shared/lib/tenantStore'
import { findActiveSubscriptionForService } from '@/modules/clients/services/subscriptions'

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
      entry_type: 'appointment',
      
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
        value_type: serviceData?.value_type,
        requires_observation: serviceData?.requires_observation
      },
      schedules: { 
        start_time: startTime,
        // Calculate end_time based on duration
        end_time: new Date(new Date(startTime).getTime() + (serviceData?.duration_minutes || 60) * 60000).toISOString()
      },
      // Desnormalizado para sumários de parceria
      partnership_id: clientData?.partnership_id || null,
    }

    await setDoc(newDocRef, appInfo)
    return { data: { appointment_id: newDocRef.id }, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

/**
 * Cria um evento flexível na agenda.
 * Eventos não têm vínculo com cliente ou serviço do catálogo.
 * O valor e a duração são informados livremente pelo usuário.
 */

export async function bookClinicEvent(params: {
  professionalId: string
  title: string
  contractor?: string
  description?: string
  price: number
  durationMinutes: number
  startTime: string
}): Promise<{ data: { appointment_id: string } | null; error: any }> {
  try {
    const { professionalId, title, contractor, description, price, durationMinutes, startTime } = params
    const appointmentsRef = collection(db, 'companies', getCompanyId(), 'appointments')
    const newDocRef = doc(appointmentsRef)

    const profSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'professionals', professionalId))
    const profData = profSnap.data()

    const endTime = new Date(new Date(startTime).getTime() + durationMinutes * 60000).toISOString()

    const eventInfo = {
      id: newDocRef.id,
      entry_type: 'event',
      professional_id: professionalId,
      professionals: { id: professionalId, name: profData?.name },
      client_id: null,
      clients: null,
      service_id: null,
      services: null,
      event_title: title,
      event_contractor: contractor || null,
      event_description: description || null,
      event_price: price,
      event_duration_minutes: durationMinutes,
      status: 'scheduled',
      created_at: new Date().toISOString(),
      schedules: {
        start_time: startTime,
        end_time: endTime,
      },
    }

    await setDoc(newDocRef, eventInfo)
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
            value_type: serviceData?.value_type,
            requires_observation: serviceData?.requires_observation
          },
          schedules: { 
            start_time: occurrenceDate.toISOString(),
            end_time: new Date(occurrenceDate.getTime() + duration * 60000).toISOString()
          },
          // Desnormalizado para sumários de parceria
          partnership_id: clientData?.partnership_id || null,
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
      where('recurrence_group_id', '==', groupId)
    )
    const snapshot = await getDocs(q)
    
    const batch = writeBatch(db)
    const newBaseDate = new Date(newStartTime)
    const oldBaseDate = new Date(sourceData.schedules.start_time)
    const diffMs = newBaseDate.getTime() - oldBaseDate.getTime()

    snapshot.docs.forEach(d => {
      const data = d.data()
      // Filter out past appointments in JS to avoid composite index requirement
      if (data.schedules.start_time < sourceData.schedules.start_time) return;

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


export async function updateAppointmentStatus(
  appointmentId: string,
  status: string,
  options?: { allowExhaustedPackageUse?: boolean },
): Promise<{ error: any }> {
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

    // OTIMIZAÇÃO E FIX: Buscar dados do serviço se for agendamento antigo (faltando desnormalização)
    let serviceData = appData.services
    if (!serviceData && appData.service_id) {
      try {
        const sRef = doc(db, 'companies', companyId, 'services', appData.service_id)
        const sSnap = await getDoc(sRef)
        if (sSnap.exists()) {
          serviceData = { id: sSnap.id, ...sSnap.data() }
        }
      } catch (e) {
        console.error("Erro ao buscar serviço legado", e)
      }
    }

    const batch = writeBatch(db)

    // Verificar se é evento flexível — lógica financeira separada
    const isEvent = appData.entry_type === 'event'

    if (isEvent) {
      // Eventos: gerar/remover financial_record baseado em event_price
      if (status === 'completed' && oldStatus !== 'completed') {
        const eventPrice = appData.event_price || 0
        if (eventPrice > 0) {
          const finRef = collection(db, 'companies', companyId, 'financial_records')
          const q = query(finRef, where('appointment_id', '==', appointmentId))
          const existingSnap = await getDocs(q)
          if (existingSnap.empty) {
            const newDoc = doc(finRef)
            batch.set(newDoc, {
              id: newDoc.id,
              client_id: null,
              professional_id: appData.professional_id,
              appointment_id: appointmentId,
              amount: eventPrice,
              payment_date: new Date().toISOString(),
              description: `Evento — ${appData.event_title || 'Sem título'}`,
              payment_method: 'manual',
              created_at: new Date().toISOString(),
            })
          }
        }
      } else if (oldStatus === 'completed' && status !== 'completed') {
        const finRef = collection(db, 'companies', companyId, 'financial_records')
        const q = query(finRef, where('appointment_id', '==', appointmentId))
        const existingSnap = await getDocs(q)
        existingSnap.docs.forEach(d => batch.delete(d.ref))
      }
      batch.update(docRef, { status })
      await batch.commit()
      return { error: null }
    }

    const isPackage = !!appData.client_package_id
    let isMonthlySubscription = serviceData?.value_type === 'monthly'

    if (!isPackage && !isMonthlySubscription && appData.client_id) {
      try {
        const subsRef = collection(db, 'companies', companyId, 'clients', appData.client_id, 'subscriptions')
        const subsSnap = await getDocs(subsRef)
        const serviceId = appData.service_id || serviceData?.id
        const subs = subsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as ClientSubscription[]
        // Mesma regra do formulário: só assinatura ATIVA cobre a sessão (cancelada não conta)
        if (findActiveSubscriptionForService(subs, serviceId)) {
          isMonthlySubscription = true
        }
      } catch (e) {
        console.error("Erro ao buscar subscriptions", e)
      }
    }

    const isAvulsa = !isPackage && !isMonthlySubscription
    let packageSessionConsumed: boolean | undefined

    // 1. Pacotes: Consumir ou estornar sessão
    if (isPackage) {
      const packageRef = doc(db, 'companies', companyId, 'clients', appData.client_id, 'packages', appData.client_package_id)
      
      const isConsumingStatus = status === 'completed' || status === 'no_show'
      const wasConsumingStatus = oldStatus === 'completed' || oldStatus === 'no_show'

      if (isConsumingStatus && !wasConsumingStatus) {
        // Consumir sessão — nunca debita abaixo de zero nem de pacote cancelado;
        // pacote indisponível exige escolha ativa (cortesia) de quem conclui
        const pkgSnap = await getDoc(packageRef)
        if (!pkgSnap.exists()) {
          packageSessionConsumed = false
        } else {
           const pkgData = pkgSnap.data()
           const pkgUnavailable =
             pkgData.status === 'cancelled' ||
             pkgData.status === 'terminated' ||
             (pkgData.sessions_remaining || 0) <= 0

           if (pkgUnavailable && !options?.allowExhaustedPackageUse) {
             const err = new Error(
               'Pacote esgotado ou cancelado. Confirme a cortesia para concluir sem debitar sessão.',
             ) as Error & { code?: string }
             err.code = 'PACKAGE_UNAVAILABLE'
             return { error: err }
           }

           if (pkgUnavailable) {
             // Cortesia confirmada: conclui sem debitar
             packageSessionConsumed = false
           } else {
             batch.update(packageRef, { sessions_remaining: increment(-1) })
             packageSessionConsumed = true
             // O aviso de "pacote acabando" para os admins é criado no servidor
             // pelo trigger onAppointmentWrite — a lista de admins vive na
             // coleção raiz `users`, que o client não pode ler
           }
        }
      } else if (wasConsumingStatus && !isConsumingStatus) {
        // Devolver sessão — apenas se ela foi de fato debitada na conclusão
        // (docs legados sem a marca mantêm o comportamento antigo de devolver)
        if (appData.package_session_consumed !== false) {
          batch.update(packageRef, { sessions_remaining: increment(1) })
        }
      }
    }

    // 2. Registro financeiro: criar (avulsa) ao concluir; ao des-concluir, remover o que
    // existir para este atendimento — independente da classificação atual, que pode ter
    // mudado desde a conclusão (ex.: assinatura cancelada depois da sessão)
    const finRef = collection(db, 'companies', companyId, 'financial_records')

    if (isAvulsa && status === 'completed' && oldStatus !== 'completed') {
      const price = serviceData?.price || 0
      const discount = appData.discount_amount || 0
      const finalPrice = Math.max(0, price - discount)

      if (finalPrice > 0) {
        try {
          const q = query(finRef, where('appointment_id', '==', appointmentId))
          const existingSnap = await getDocs(q)

          if (existingSnap.empty) {
            const newDoc = doc(finRef)
            batch.set(newDoc, {
              id: newDoc.id,
              client_id: appData.client_id,
              professional_id: appData.professional_id,
              appointment_id: appointmentId,
              amount: finalPrice,
              payment_date: new Date().toISOString(),
              description: `Sessão Avulsa - ${serviceData?.name || 'Serviço'}`,
              payment_method: 'manual',
              created_at: new Date().toISOString()
            })
          }
        } catch (e) {
          console.error("Erro ao buscar/criar financial record (finalPrice > 0)", e)
        }
      }
    } else if (oldStatus === 'completed' && status !== 'completed') {
      try {
        const q = query(finRef, where('appointment_id', '==', appointmentId))
        const existingSnap = await getDocs(q)
        existingSnap.docs.forEach(d => batch.delete(d.ref))
      } catch (e) {
        console.error("Erro ao buscar/deletar financial record (oldStatus === completed)", e)
      }
    }

    // Atualiza o status do agendamento ao final (com a marca de consumo do pacote,
    // para o estorno devolver sessão apenas quando ela foi de fato debitada)
    batch.update(
      docRef,
      packageSessionConsumed === undefined
        ? { status }
        : { status, package_session_consumed: packageSessionConsumed },
    )

    // Professional Notification: Prontuário Pendente
    if (status === 'completed' && oldStatus !== 'completed' && !isEvent) {
      const requiresObs = serviceData?.requires_observation
      
      const hasNotes = appData.notes && appData.notes.length > 0
      
      if (requiresObs && !hasNotes) {
        const notifRef = doc(db, 'companies', companyId, 'professionals', appData.professional_id, 'notifications', `missing_note_${appointmentId}`)
        batch.set(notifRef, {
          id: notifRef.id,
          professional_id: appData.professional_id,
          title: 'Prontuário Pendente',
          content: `O atendimento de ${appData.clients?.name || 'um cliente'} foi concluído. Por favor, adicione a evolução/observação.`,
          is_read: false,
          link: null,
          created_at: new Date().toISOString()
        })
      }
    }

    try {
      await batch.commit()
    } catch (e) {
      console.error("Erro no batch.commit()", e)
      throw e
    }
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


export async function deleteAppointment(appointmentId: string): Promise<{ deletedIds?: string[], error: any }> {
  try {
    const companyId = getCompanyId()
    const docRef = doc(db, 'companies', companyId, 'appointments', appointmentId)
    
    // Processar devolução de sessão e/ou finanças
    const appSnap = await getDoc(docRef)
    if (appSnap.exists()) {
       const appData = appSnap.data()
       const isEvent = appData.entry_type === 'event'

       // Eventos: apenas remover financial_record se existir, depois deletar
       if (isEvent) {
         if (appData.status === 'completed') {
           const finRef = collection(db, 'companies', companyId, 'financial_records')
           const q = query(finRef, where('appointment_id', '==', appointmentId))
           const existingSnap = await getDocs(q)
           await Promise.all(existingSnap.docs.map(d => deleteDoc(d.ref)))
         }
       } else {
         // Agendamentos normais: devolver sessão de pacote e remover registro financeiro.
         // O registro é removido por existência (query por appointment_id) — não se adivinha
         // pela assinatura, que pode ter mudado de status desde a conclusão.
         const isPackage = !!appData.client_package_id
         const wasConsumingStatus = appData.status === 'completed' || appData.status === 'no_show'

         if (isPackage && wasConsumingStatus && appData.client_id && appData.package_session_consumed !== false) {
           const packageRef = doc(db, 'companies', companyId, 'clients', appData.client_id, 'packages', appData.client_package_id)
           await updateDoc(packageRef, { sessions_remaining: increment(1) })
         }

         if (appData.status === 'completed') {
           const finRef = collection(db, 'companies', companyId, 'financial_records')
           const q = query(finRef, where('appointment_id', '==', appointmentId))
           const existingSnap = await getDocs(q)
           await Promise.all(existingSnap.docs.map(d => deleteDoc(d.ref)))
         }
       }
    }
    
    await deleteDoc(docRef)
    return { deletedIds: [appointmentId], error: null }
  } catch (error) { return { deletedIds: [], error } }
}


export async function deleteFutureAppointments(appointmentId: string): Promise<{ deletedIds?: string[], error: any }> {
  try {
    const companyId = getCompanyId()
    const sourceDocRef = doc(db, 'companies', companyId, 'appointments', appointmentId)
    const sourceSnap = await getDoc(sourceDocRef)
    if (!sourceSnap.exists()) return { error: new Error('Agendamento não encontrado') }
    
    const sourceData = sourceSnap.data()
    const groupId = sourceData.recurrence_group_id
    
    // If not recurring, just do a normal delete
    if (!sourceData.is_recurring) {
      return deleteAppointment(appointmentId)
    }

    const appointmentsRef = collection(db, 'companies', companyId, 'appointments')
    let snapshotDocs: any[] = []

    if (groupId) {
      const q = query(
        appointmentsRef,
        where('recurrence_group_id', '==', groupId)
      )
      const snapshot = await getDocs(q)
      snapshotDocs = snapshot.docs
    } else {
      // Legacy fallback: Query by client_id and filter in JS
      if (!sourceData.client_id) {
         return deleteAppointment(appointmentId)
      }
      const q = query(
        appointmentsRef,
        where('client_id', '==', sourceData.client_id)
      )
      const clientSnap = await getDocs(q)
      
      snapshotDocs = clientSnap.docs.filter(d => {
        const data = d.data()
        return data.is_recurring === true &&
               data.professional_id === sourceData.professional_id &&
               data.service_id === sourceData.service_id &&
               data.schedules?.start_time
      })
    }
    
    let batch = writeBatch(db)
    const batches: any[] = []
    let operationCount = 0

    const commitOperation = () => {
      operationCount++
      if (operationCount >= 450) {
        batches.push(batch.commit())
        batch = writeBatch(db)
        operationCount = 0
      }
    }

    const packageRefunds = new Map<string, number>()
    const finAppointmentsToDelete: string[] = []
    const deletedIds: string[] = []

    const sourceStartTimeStr = sourceData.schedules?.start_time
    const sourceStartTimeMs = sourceStartTimeStr ? new Date(sourceStartTimeStr).getTime() : 0

    snapshotDocs.forEach(d => {
      const appData = d.data()
      const appStartTimeStr = appData.schedules?.start_time
      
      // Safety check: ensure schedules exist and can be parsed
      if (!appStartTimeStr) return;
      
      const appStartTimeMs = new Date(appStartTimeStr).getTime()
      
      // Filter out past appointments in JS to avoid composite index requirement
      if (appStartTimeMs < sourceStartTimeMs) return;

      const isPackage = !!appData.client_package_id
      const wasConsumingStatus = appData.status === 'completed' || appData.status === 'no_show'

      if (isPackage && wasConsumingStatus && appData.package_session_consumed !== false) {
        if (appData.client_id && appData.client_package_id) {
          const pkgPath = `companies/${companyId}/clients/${appData.client_id}/packages/${appData.client_package_id}`
          const currentRefunds = packageRefunds.get(pkgPath) || 0
          packageRefunds.set(pkgPath, currentRefunds + 1)
        }
      }

      // Registros financeiros são removidos por existência: a busca posterior só encontra
      // o que de fato foi faturado (avulsas) — assinaturas nunca tiveram registro
      if (appData.status === 'completed') {
        finAppointmentsToDelete.push(d.id)
      }

      batch.delete(d.ref)
      commitOperation()
      deletedIds.push(d.id)
    })
    
    // Aplicar devoluções de pacotes
    for (const [pkgPath, refundsCount] of packageRefunds.entries()) {
      const pkgRef = doc(db, pkgPath)
      batch.update(pkgRef, { sessions_remaining: increment(refundsCount) })
      commitOperation()
    }
    
    // Deletar registros financeiros associados
    if (finAppointmentsToDelete.length > 0) {
      const finRef = collection(db, 'companies', companyId, 'financial_records')
      // Processar em baterias de 30 para evitar erro de query "IN"
      for (let i = 0; i < finAppointmentsToDelete.length; i += 30) {
        const chunk = finAppointmentsToDelete.slice(i, i + 30)
        const finQuery = query(finRef, where('appointment_id', 'in', chunk))
        const finSnap = await getDocs(finQuery)
        finSnap.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref)
          commitOperation()
        })
      }
    }

    if (operationCount > 0) {
      batches.push(batch.commit())
    }
    await Promise.all(batches)

    return { deletedIds, error: null }
  } catch (error) {
    console.error("Error deleting future appointments:", error)
    return { deletedIds: [], error }
  }
}


export async function completeAppointment(
  appointmentId: string,
  options?: { allowExhaustedPackageUse?: boolean },
): Promise<{ error: any }> {
  return updateAppointmentStatus(appointmentId, 'completed', options)
}


export async function markAppointmentAsNoShow(
  appointmentId: string,
  options?: { allowExhaustedPackageUse?: boolean },
): Promise<{ error: any }> {
  return updateAppointmentStatus(appointmentId, 'no_show', options)
}


export async function cancelAppointment(appointmentId: string): Promise<{ error: any }> {
  return updateAppointmentStatus(appointmentId, 'cancelled')
}


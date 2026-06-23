import { db } from '@/shared/lib/firebase'
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  collectionGroup,
  orderBy,
  where,
  getCountFromServer,
  limit as fbLimit,
  writeBatch,
} from 'firebase/firestore'
import { Client, ClientPackageWithDetails, ClientSubscription, Appointment, NoteEntry, ClientExam } from '@/shared/types'
import { getCompanyId } from '@/shared/lib/tenantStore'

export async function addClientNote(clientId: string, note: Omit<NoteEntry, 'id'> & { date?: string }): Promise<{ data: NoteEntry | null; error: any }> {
  try {
    const notesRef = collection(db, 'companies', getCompanyId(), 'clients', clientId, 'notes')
    const newDoc = doc(notesRef)
    
    let finalContent = note.content
    const noteDate = note.date || new Date().toISOString()
    
    if (note.type === 'evolution' && note.date) {
      const dateObj = new Date(note.date)
      const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`
      
      if (!finalContent.startsWith(`[Data do Atendimento:`)) {
        finalContent = `[Data do Atendimento: ${formattedDate}]\n\n${finalContent}`
      }
    }

    const newNote = {
      id: newDoc.id,
      client_id: clientId,
      ...note,
      date: noteDate,
      content: finalContent
    }
    
    await setDoc(newDoc, newNote)

    if (note.appointment_id) {
      const apptRef = doc(db, 'companies', getCompanyId(), 'appointments', note.appointment_id)
      updateDoc(apptRef, { has_clinical_notes: true }).catch(() => {})
      
      getDoc(apptRef).then(snap => {
         const appData = snap.data()
         if (appData && appData.professional_id) {
             const notifRef = doc(db, 'companies', getCompanyId(), 'professionals', appData.professional_id, 'notifications', `missing_note_${note.appointment_id}`)
             updateDoc(notifRef, { is_read: true }).catch(() => {})
         }
      }).catch(() => {})
    }

    return { data: newNote as NoteEntry, error: null }
  } catch (error) {
    console.error("Erro ao adicionar nota do cliente:", error)
    return { data: null, error }
  }
}


export async function updateClientNote(clientId: string, noteId: string, content: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'clients', clientId, 'notes', noteId)
    await updateDoc(docRef, { content, updated_at: new Date().toISOString() })
    return { error: null }
  } catch (error) {
    return { error }
  }
}


export async function deleteClientNote(clientId: string, noteId: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'clients', clientId, 'notes', noteId)
    await deleteDoc(docRef)
    return { error: null }
  } catch (error) {
    return { error }
  }
}


export async function getClientNotesByAppointment(clientId: string, appointmentId: string): Promise<{ data: NoteEntry[] | null; error: any }> {
  try {
    const notesRef = collection(db, 'companies', getCompanyId(), 'clients', clientId, 'notes')
    const q = query(notesRef, where('appointment_id', '==', appointmentId), orderBy('date', 'asc'))
    const snapshot = await getDocs(q)

    const allNotes: NoteEntry[] = []
    snapshot.forEach(doc => {
      allNotes.push(doc.data() as NoteEntry)
    })

    return { data: allNotes, error: null }
  } catch (error) {
    console.error("Error fetching notes by appointment:", error)
    return { data: null, error }
  }
}


export async function getClientImportedHistory(clientId: string): Promise<{ data: NoteEntry[] | null; error: any }> {
  try {
    const notesRef = collection(db, 'companies', getCompanyId(), 'clients', clientId, 'notes')
    const q = query(notesRef, where('type', '==', 'imported_history'), orderBy('date', 'desc'))
    const snapshot = await getDocs(q)

    const allNotes: NoteEntry[] = []
    snapshot.forEach(doc => {
      allNotes.push(doc.data() as NoteEntry)
    })

    return { data: allNotes, error: null }
  } catch (error) {
    console.error("Error fetching imported history:", error)
    return { data: null, error }
  }
}

// Temporary Migration Script

export async function migrateAllClientNotes(companyIdToUse: string): Promise<{ success: boolean; migrated: number; error: any }> {
  try {
    let count = 0
    // 1. Migrate notes from appointments
    const apptsRef = collection(db, 'companies', companyIdToUse, 'appointments')
    const apptsSnap = await getDocs(apptsRef)

    for (const apptDoc of apptsSnap.docs) {
      const apptData = apptDoc.data()
      if (apptData.client_id && apptData.notes && Array.isArray(apptData.notes) && apptData.notes.length > 0) {
        for (const note of apptData.notes) {
          const notesRef = collection(db, 'companies', companyIdToUse, 'clients', apptData.client_id, 'notes')

          // Check if already migrated
          const q = query(notesRef, where('date', '==', note.date))
          const exists = await getDocs(q)
          if (exists.empty) {
            const newDoc = doc(notesRef)
            await setDoc(newDoc, {
              id: newDoc.id,
              client_id: apptData.client_id,
              appointment_id: apptDoc.id,
              type: 'evolution',
              ...note
            })
            count++
          }
        }
      }
    }

    // 2. Migrate imported history from clients
    const clientsRef = collection(db, 'companies', companyIdToUse, 'clients')
    const clientsSnap = await getDocs(clientsRef)

    for (const clientDoc of clientsSnap.docs) {
      const clientData = clientDoc.data()
      const generalAssessment = clientData.general_assessment

      if (generalAssessment && Array.isArray(generalAssessment)) {
        for (const entry of generalAssessment) {
          if (entry.type === 'imported_history') {
            const notesRef = collection(db, 'companies', companyIdToUse, 'clients', clientDoc.id, 'notes')

            // Check if already migrated
            const q = query(notesRef, where('date', '==', entry.date))
            const exists = await getDocs(q)
            if (exists.empty) {
              const newDoc = doc(notesRef)
              await setDoc(newDoc, {
                id: newDoc.id,
                client_id: clientDoc.id,
                type: 'imported_history',
                ...entry
              })
              count++
            }
          }
        }
      }
    }

    return { success: true, migrated: count, error: null }
  } catch (error) {
    console.error("Migration error:", error)
    return { success: false, migrated: 0, error }
  }
}


export async function getClientNotesPaginated(
  clientId: string,
  page: number = 1,
  pageSize: number = 10
): Promise<{ data: NoteEntry[] | null; totalCount: number; error: any }> {
  try {
    const notesRef = collection(db, 'companies', getCompanyId(), 'clients', clientId, 'notes')
    const q = query(notesRef, orderBy('date', 'desc'))
    const snapshot = await getDocs(q)

    const allNotes: NoteEntry[] = []
    snapshot.forEach(doc => {
      allNotes.push(doc.data() as NoteEntry)
    })

    const totalCount = allNotes.length
    const startIndex = (page - 1) * pageSize
    const slicedNotes = allNotes.slice(startIndex, startIndex + pageSize)

    return { data: slicedNotes, totalCount, error: null }
  } catch (error) {
    console.error("Error fetching paginated client notes:", error)
    return { data: null, totalCount: 0, error }
  }
}


export async function getLastClientNotes(clientId: string, limit: number = 5): Promise<{ data: NoteEntry[] | null; hasMore: boolean; totalCount: number; error: any }> {
  try {
    const notesRef = collection(db, 'companies', getCompanyId(), 'clients', clientId, 'notes')
    const q = query(notesRef, orderBy('date', 'desc'))
    const snapshot = await getDocs(q)

    const allNotes: NoteEntry[] = []
    snapshot.forEach(doc => {
      allNotes.push(doc.data() as NoteEntry)
    })

    const totalCount = allNotes.length
    const hasMore = totalCount > limit
    const slicedNotes = allNotes.slice(0, limit)

    return { data: slicedNotes, hasMore, totalCount, error: null }
  } catch (error) {
    console.error("Error fetching last client notes:", error)
    return { data: null, hasMore: false, totalCount: 0, error }
  }
}

/**
 * Busca notas do cliente com fallback robusto:
 * 1. Lê da nova subcoleção /clients/{id}/notes (source of truth)
 * 2. Verifica agendamentos que possam ter notas legadas ainda não migradas (campo notes[])
 * 3. Deduplica por date para evitar duplicações durante período de transição
 */

export async function getClientNotesWithFallback(
  clientId: string,
  page: number = 1,
  pageSize: number = 10
): Promise<{ data: NoteEntry[] | null; totalCount: number; hasMore: boolean; error: any }> {
  try {
    const companyId = getCompanyId()

    // 1. Buscar notas da subcoleção (nova arquitetura)
    const notesRef = collection(db, 'companies', companyId, 'clients', clientId, 'notes')
    const notesSnap = await getDocs(query(notesRef, orderBy('date', 'desc')))
    const subcollectionNotes: NoteEntry[] = []
    notesSnap.forEach(d => subcollectionNotes.push({ ...d.data(), id: d.id } as NoteEntry))

    // 2. Buscar notas legadas dos agendamentos (campo notes[] no documento)
    const apptsRef = collection(db, 'companies', companyId, 'appointments')
    const apptsSnap = await getDocs(query(apptsRef, where('client_id', '==', clientId)))
    const legacyNotes: NoteEntry[] = []
    apptsSnap.forEach(d => {
      const data = d.data()
      if (data.notes && Array.isArray(data.notes)) {
        data.notes.forEach((n: NoteEntry) => {
          legacyNotes.push({ ...n, appointment_id: d.id })
        })
      }
    })

    // 3. Mesclar: começar com subcoleção e adicionar legadas não duplicadas (por date)
    const subcollectionDates = new Set(subcollectionNotes.map(n => n.date))
    const merged = [...subcollectionNotes]
    legacyNotes.forEach(n => {
      if (!subcollectionDates.has(n.date)) {
        merged.push(n)
      }
    })

    // 4. Ordenar por data decrescente
    merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const totalCount = merged.length
    const startIndex = (page - 1) * pageSize
    const sliced = merged.slice(startIndex, startIndex + pageSize)

    return { data: sliced, totalCount, hasMore: startIndex + pageSize < totalCount, error: null }
  } catch (error) {
    console.error('Erro em getClientNotesWithFallback:', error)
    return { data: null, totalCount: 0, hasMore: false, error }
  }
}


export async function fixNotesDates(companyIdToUse: string): Promise<{ success: boolean; fixed: number; error: any }> {
  try {
    let count = 0
    const clientsRef = collection(db, 'companies', companyIdToUse, 'clients')
    const clientsSnap = await getDocs(clientsRef)
    const batch = writeBatch(db)

    for (const clientDoc of clientsSnap.docs) {
      const notesRef = collection(db, 'companies', companyIdToUse, 'clients', clientDoc.id, 'notes')
      const notesSnap = await getDocs(notesRef)

      for (const noteDoc of notesSnap.docs) {
        const noteData = noteDoc.data()
        
        if (noteData.appointment_id && noteData.type === 'evolution') {
          // Fetch appointment to get real date
          const apptRef = doc(db, 'companies', companyIdToUse, 'appointments', noteData.appointment_id)
          const apptSnap = await getDoc(apptRef)
          
          if (apptSnap.exists()) {
            const apptData = apptSnap.data()
            const realDate = apptData.schedules?.start_time
            
            if (realDate) {
              let finalContent = noteData.content || ''
              const dateObj = new Date(realDate)
              const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`
              
              if (!finalContent.startsWith(`[Data do Atendimento:`)) {
                finalContent = `[Data do Atendimento: ${formattedDate}]\n\n${finalContent}`
              }

              batch.update(noteDoc.ref, {
                date: realDate,
                content: finalContent
              })
              count++
            }
          }
        }
      }
    }
    
    if (count > 0) {
      await batch.commit()
    }
    return { success: true, fixed: count, error: null }
  } catch (error) {
    console.error("Migration error:", error)
    return { success: false, fixed: 0, error }
  }
}





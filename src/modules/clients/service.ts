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
} from 'firebase/firestore'
import { Client, ClientPackageWithDetails, ClientSubscription, Appointment, NoteEntry, ClientExam } from '@/shared/types'
import { format, startOfMonth, endOfMonth, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { jsPDF } from 'jspdf'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import { uploadFile } from '@/shared/lib/storage'
import { deleteObject, ref, getDownloadURL } from 'firebase/storage'
import { storage } from '@/shared/lib/firebase'

import { getCompanyId } from '@/shared/lib/tenantStore'

export async function getClientsByProfessional(
  professionalId: string,
): Promise<{ data: Client[] | null; error: any }> {
  try {
    // No Firebase, procuramos os appointments do profissional
    const apptsRef = collection(db, 'companies', getCompanyId(), 'appointments')
    const qAppts = query(apptsRef, where('professional_id', '==', professionalId))
    const apptsSnap = await getDocs(qAppts)

    if (apptsSnap.empty) return { data: [], error: null }

    // Pega IDs únicos de clientes
    const clientIds = [...new Set(apptsSnap.docs.map(doc => doc.data().client_id))]
    if (clientIds.length === 0) return { data: [], error: null }

    // No Firestore, 'in' aceita array de até 30 itens. Para simplificar no momento, faremos chamadas em lote simples.
    // O ideal futuro seria desnormalizar uma subcoleção no próprio professional.
    const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')
    // Splitting into chunks of 10 for safe 'in' queries
    const chunks = []
    for (let i = 0; i < clientIds.length; i += 10) {
      chunks.push(clientIds.slice(i, i + 10))
    }

    const clients: Client[] = []
    for (const chunk of chunks) {
      const qClients = query(clientsRef, where('__name__', 'in', chunk))
      const snap = await getDocs(qClients)
      snap.forEach(doc => {
        const data = doc.data()
        if (data.is_active === true) {
          clients.push({ id: doc.id, ...data } as Client)
        }
      })
    }

    return { data: clients, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getAllClients(filter?: {
  status?: 'all' | 'active' | 'inactive'
  serviceId?: string
}): Promise<{ data: Client[] | null; error: any }> {
  try {
    const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')
    let q = query(clientsRef, orderBy('name', 'asc'))

    if (filter?.status === 'active') {
      q = query(clientsRef, where('is_active', '==', true), orderBy('name', 'asc'))
    } else if (filter?.status === 'inactive') {
      q = query(clientsRef, where('is_active', '==', false), orderBy('name', 'asc'))
    }

    const snapshot = await getDocs(q)
    const clients: Client[] = []
    snapshot.forEach(doc => {
      clients.push({ id: doc.id, ...doc.data() } as Client)
    })

    return { data: clients, error: null }
  } catch (error) {
    console.error("🔥 [AÇÃO NECESSÁRIA - CLIQUE NO LINK ABAIXO PARA CRIAR ÍNDICE DE CLIENTES]: ", error)
    return { data: null, error }
  }
}

export async function getClientsCount(filter?: { status?: 'all' | 'active' | 'inactive' }): Promise<{ count: number; error: any }> {
  try {
    const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')
    let q = query(clientsRef)

    if (filter?.status === 'active') {
      q = query(clientsRef, where('is_active', '==', true))
    } else if (filter?.status === 'inactive') {
      q = query(clientsRef, where('is_active', '==', false))
    }

    const snapshot = await getCountFromServer(q)
    return { count: snapshot.data().count, error: null }
  } catch (error) {
    console.error("🔥 Erro ao puxar contador de clientes: ", error)
    return { count: 0, error }
  }
}

export async function getClientById(
  clientId: string,
): Promise<{ data: Client | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'clients', clientId)
    const snapshot = await getDoc(docRef)

    if (!snapshot.exists()) return { data: null, error: new Error('Cliente não encontrado') }
    return { data: { id: snapshot.id, ...snapshot.data() } as Client, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function createClient(
  clientData: Omit<Client, 'id' | 'created_at' | 'user_id' | 'is_active'>,
): Promise<{ data: Client | null; error: any }> {
  try {
    const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')
    const newDocRef = doc(clientsRef)

    // Parse birth date for indexing: "YYYY-MM-DD" -> "MM-DD"
    let birth_month_day = null
    if (clientData.birth_date) {
      const parts = clientData.birth_date.split('-')
      if (parts.length >= 3) {
        birth_month_day = `${parts[1]}-${parts[2]}`
      }
    }

    const newClient = { 
      id: newDocRef.id, 
      ...clientData, 
      is_active: true,
      birth_month_day,
    }

    await setDoc(newDocRef, newClient)
    return { data: newClient as Client, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function updateClient(
  clientId: string,
  updates: Partial<Client>,
): Promise<{ data: Client | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'clients', clientId)
    
    // Auto-update birth_month_day if birth_date is changed
    if (updates.birth_date) {
      const parts = updates.birth_date.split('-')
      if (parts.length >= 3) {
        (updates as any).birth_month_day = `${parts[1]}-${parts[2]}`
      }
    }

    await updateDoc(docRef, updates)

    const snapshot = await getDoc(docRef)
    return { data: { id: snapshot.id, ...snapshot.data() } as Client, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function deleteClient(clientId: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'clients', clientId)
    await deleteDoc(docRef)
    return { error: null }
  } catch (error) {
    return { error }
  }
}

// Stubs for Payments, Memberships and Reports for now.
// O Supabase antigo tinha funções complexas para esses três que precisarão
// ser gradualmente construídas como subcoleções no Firestore.
// Subcoleções ativas para a UI
export async function getClientPackages(clientId: string): Promise<{ data: any[] | null; error: any }> {
  try {
    const pkgsRef = collection(db, 'companies', getCompanyId(), 'clients', clientId, 'packages')
    const snap = await getDocs(pkgsRef)

    const results = []
    for (const d of snap.docs) {
      const data = d.data()
      const cp = { id: d.id, ...data } as any
      if (data.package_id) {
        const pSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'packages', data.package_id))
        if (pSnap.exists()) {
          const pkgData = pSnap.data()
          let sData = null
          if (pkgData.service_id) {
            const sSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'services', pkgData.service_id))
            if (sSnap.exists()) sData = { id: sSnap.id, ...sSnap.data() }
          }
          cp.packages = { ...pkgData, services: sData }
        }
      }
      results.push(cp)
    }
    return { data: results, error: null }
  } catch (error) { return { data: null, error } }
}

export async function getAllActiveClientPackages(options?: { limit?: number }): Promise<{ data: any[] | null; error: any }> {
  try {
    const pkgsRef = collectionGroup(db, 'packages')
    let q = query(pkgsRef)
    if (options?.limit) {
      q = query(pkgsRef, fbLimit(options.limit))
    }
    const snap = await getDocs(q)

    const results = []
    for (const d of snap.docs) {
      // Only include packages inside our own company tree
      if (!d.ref.path.startsWith(`companies/${getCompanyId()}/`)) continue
      
      const data = d.data()
      // Filter: only packages with sessions remaining
      if ((data.sessions_remaining || 0) <= 0) continue
      
      const cp = { id: d.id, ...data } as any
      // Hidratação de Cliente
      if (data.client_id) {
        const cSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'clients', data.client_id))
        if (cSnap.exists()) cp.clients = { id: cSnap.id, ...cSnap.data() }
      }
      // Hidratação de Pacote
      if (data.package_id) {
        const pSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'packages', data.package_id))
        if (pSnap.exists()) cp.packages = { id: pSnap.id, ...pSnap.data() }
      }
      results.push(cp)
    }
    return { data: results, error: null }
  } catch (error) {
    console.error("🔥 ERRO EM getAllActiveClientPackages: ", error)
    return { data: null, error }
  }
}

export async function assignPackageToClient(clientId: string, packageId: string, sessions: number, purchaseDate?: Date, discountAmount: number = 0): Promise<{ error: any }> {
  try {
    const pkgsRef = collection(db, 'companies', getCompanyId(), 'clients', clientId, 'packages')
    const newDoc = doc(pkgsRef)
    await setDoc(newDoc, {
      id: newDoc.id,
      client_id: clientId,
      package_id: packageId,
      sessions_remaining: sessions,
      purchase_date: purchaseDate ? purchaseDate.toISOString() : new Date().toISOString(),
      discount_amount: discountAmount
    })
    return { error: null }
  } catch (error) { return { error } }
}

export async function cancelClientPackage(clientId: string, clientPackageId: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'clients', clientId, 'packages', clientPackageId)
    await updateDoc(docRef, { status: 'cancelled', cancelled_at: new Date().toISOString() })
    return { error: null }
  } catch (error) { return { error } }
}

export async function getClientSubscriptions(clientId: string): Promise<{ data: any[] | null; error: any }> {
  try {
    const subsRef = collection(db, 'companies', getCompanyId(), 'clients', clientId, 'subscriptions')
    const snap = await getDocs(subsRef)

    const results = []
    for (const d of snap.docs) {
      const data = d.data()
      const sub = { id: d.id, ...data } as any

      if (data.service_id) {
        const sSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'services', data.service_id))
        if (sSnap.exists()) sub.services = { id: sSnap.id, ...sSnap.data() }
      }
      if (data.subscription_plan_id) {
        const pSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'subscription_plans', data.subscription_plan_id))
        if (pSnap.exists()) sub.subscription_plans = { id: pSnap.id, ...pSnap.data() }
      }

      results.push(sub)
    }
    return { data: results, error: null }
  } catch (error) {
    console.error("🔥 ERRO EM getClientSubscriptions (falta de índice?): ", error)
    return { data: null, error }
  }
}

export async function createClientSubscription(data: any): Promise<{ data: any | null; error: any }> {
  try {
    const subsRef = collection(db, 'companies', getCompanyId(), 'clients', data.client_id, 'subscriptions')
    const newDoc = doc(subsRef)
    const docData = { ...data, id: newDoc.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    await setDoc(newDoc, docData)
    return { data: docData, error: null }
  } catch (error) {
    return { data: null, error }
  }
}
export async function updateClientSubscription(subId: string, updates: any): Promise<{ error: any }> {
  return { error: null }
}
export async function cancelClientSubscription(clientId: string, subId: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', getCompanyId(), 'clients', clientId, 'subscriptions', subId)
    await updateDoc(docRef, { status: 'cancelled', cancelled_at: new Date().toISOString() })
    return { error: null }
  } catch (error) { return { error } }
}

export async function getMonthlyClientUsage(clientId: string, serviceId: string): Promise<{ count: number; error: any }> {
  return { count: 0, error: null }
}

export async function getClientExams(clientId: string): Promise<{ data: ClientExam[] | null; error: any }> {
  try {
    const examsRef = collection(db, 'companies', getCompanyId(), 'clients', clientId, 'exams')
    const q = query(examsRef, orderBy('created_at', 'desc'))
    const snap = await getDocs(q)
    const exams: ClientExam[] = []
    snap.forEach(doc => {
      exams.push({ id: doc.id, ...doc.data() } as ClientExam)
    })
    return { data: exams, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function uploadClientExam(
  clientId: string,
  examData: Omit<ClientExam, 'id' | 'file_url' | 'file_path' | 'created_at'>,
  file: File
): Promise<{ data: ClientExam | null; error: any }> {
  try {
    const companyId = getCompanyId()
    const timestamp = new Date().getTime()
    const filePath = `companies/${companyId}/clients/${clientId}/exams/${timestamp}_${file.name}`
    const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'fpl-saude.firebasestorage.app'
    
    const { data: uploadSnap, error: uploadError } = await uploadFile(bucket, filePath, file)
    if (uploadError) throw uploadError

    const fileUrl = await getDownloadURL(uploadSnap.ref)
    
    const examsRef = collection(db, 'companies', companyId, 'clients', clientId, 'exams')
    const newDoc = doc(examsRef)
    const newExam: ClientExam = {
      id: newDoc.id,
      client_id: clientId,
      ...examData,
      file_url: fileUrl,
      file_path: filePath,
      created_at: new Date().toISOString()
    }

    await setDoc(newDoc, newExam)
    return { data: newExam, error: null }
  } catch (error) {
    console.error("Erro ao fazer upload do exame: ", error)
    return { data: null, error }
  }
}

export async function deleteClientExam(clientId: string, examId: string, filePath: string): Promise<{ error: any }> {
  try {
    const companyId = getCompanyId()
    const docRef = doc(db, 'companies', companyId, 'clients', clientId, 'exams', examId)
    await deleteDoc(docRef)

    const storageRef = ref(storage, filePath)
    await deleteObject(storageRef)

    return { error: null }
  } catch (error) {
    return { error }
  }
}
export async function exportClientData(clientId: string, exportType: string, formatType: 'pdf' | 'docx'): Promise<{ data: any | null; error: any }> {
  try {
    // 1. Buscando o nome do paciente
    const patientSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'clients', clientId))
    if (!patientSnap.exists()) {
      return { data: null, error: new Error('Paciente não encontrado') }
    }
    const patient = patientSnap.data()

    // 2. Buscando todas as consultas do paciente para agrupar as anotações
    const apptsRef = collection(db, 'companies', getCompanyId(), 'appointments')
    const q = query(apptsRef, where('client_id', '==', clientId))
    const apptsSnap = await getDocs(q)
    
    // 3. Consolidando e ordenando anotações (mais recentes primeiro)
    let allNotes: NoteEntry[] = []
    apptsSnap.forEach(doc => {
      const data = doc.data()
      if (data.notes && Array.isArray(data.notes)) {
        allNotes.push(...data.notes)
      }
    })
    
    allNotes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    if (allNotes.length === 0) {
       return { data: null, error: new Error('O paciente não possui anotações para exportar.') }
    }

    const reportDate = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
    const sanitizedName = patient.name.replace(/[^a-zA-Z0-9_-]/g, '_')
    const filename = `Historico_Clinico_${sanitizedName}_${format(new Date(), 'ddMMyyyy_HHmm')}.${formatType}`

    // 4. Gerando PDF
    if (formatType === 'pdf') {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      let yOffset = 20
      
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text('Histórico de Sessões - Prontuário Clínico', pageWidth / 2, yOffset, { align: 'center' })
      yOffset += 10
      
      doc.setFontSize(12)
      doc.text(`Paciente: ${patient.name}`, 15, yOffset)
      yOffset += 6
      doc.setFont('helvetica', 'normal')
      doc.text(`Gerado em: ${reportDate}`, 15, yOffset)
      yOffset += 12
      
      doc.line(15, yOffset, pageWidth - 15, yOffset)
      yOffset += 8

      // Percorre e preenche o PDF (respeitando quebra de páginas manuais por altura)
      for (const note of allNotes) {
         if (yOffset > 270) {
            doc.addPage()
            yOffset = 20
         }
         
         const dateString = format(new Date(note.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
         
         doc.setFont('helvetica', 'bold')
         doc.text(`Data: ${dateString} | Profissional: ${note.professional_name || 'Desconhecido'}`, 15, yOffset)
         yOffset += 6
         
         doc.setFont('helvetica', 'normal')
         
         // Split text para não vazar a folha A4
         const splitText = doc.splitTextToSize(note.content, pageWidth - 30)
         
         // Se estourar a página atual durante o texto, joga pra próxima
         if ((yOffset + (splitText.length * 6)) > 280) {
             doc.addPage()
             yOffset = 20
         }
         
         doc.text(splitText, 15, yOffset)
         yOffset += (splitText.length * 5) + 8
         
         doc.line(15, yOffset, pageWidth - 15, yOffset) // separador
         yOffset += 8
      }
      
      const pdfBase64 = doc.output('datauristring').split(',')[1]
      return { data: { content: pdfBase64, filename }, error: null }
    } 
    
    // 5. Gerando DOCX
    else if (formatType === 'docx') {
       const docxSections = []
       
       // Header Page
       docxSections.push(
          new Paragraph({
             text: "Histórico de Sessões - Prontuário Clínico",
             heading: HeadingLevel.HEADING_1,
             alignment: AlignmentType.CENTER,
             spacing: { after: 300 }
          }),
          new Paragraph({
             children: [
                new TextRun({ text: `Paciente: `, bold: true }),
                new TextRun({ text: patient.name })
             ],
             spacing: { after: 100 }
          }),
          new Paragraph({
             children: [
                new TextRun({ text: `Gerado em: `, bold: true }),
                new TextRun({ text: reportDate })
             ],
             spacing: { after: 300 }
          })
       )

       // Percorre Notas
       for (const note of allNotes) {
          const dateString = format(new Date(note.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
          
          docxSections.push(
              new Paragraph({
                children: [
                   new TextRun({ text: `Data: ${dateString} | Profissional: ${note.professional_name || 'Desconhecido'}`, bold: true, size: 24 }) // Size é half-points (24 = 12pt)
                ],
                spacing: { before: 200, after: 100 }
              }),
              new Paragraph({
                 text: note.content,
                 spacing: { after: 300 }
              })
          )
       }

       const docxDocument = new Document({
          creator: "FPL Saúde",
          title: "Histórico Clínico",
          sections: [{
              properties: {},
              children: docxSections
          }]
       })
       
       const base64Content = await Packer.toBase64String(docxDocument)
       return { data: { content: base64Content, filename }, error: null }
    }

    return { data: null, error: new Error('Formato de arquivo não suportado.') }
  } catch (error) {
    console.error("Erro ao gerar exportação: ", error)
    return { data: null, error }
  }
}
export async function getClientsWithBirthdayThisWeek(startDate: Date, endDate: Date): Promise<{ data: Client[] | null; error: any }> {
  try {
    const startStr = format(startDate, 'MM-dd')
    const endStr = format(endDate, 'MM-dd')
    const clientsRef = collection(db, 'companies', getCompanyId(), 'clients')
    
    let results: Client[] = []

    if (startStr <= endStr) {
      // Normal week inside the same year
      const q = query(
        clientsRef,
        where('is_active', '==', true),
        where('birth_month_day', '>=', startStr),
        where('birth_month_day', '<=', endStr)
      )
      const snapshot = await getDocs(q)
      snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() } as Client))
    } else {
      // End of year crossing (e.g. 12-30 to 01-05) - requires two queries
      const q1 = query(
        clientsRef,
        where('is_active', '==', true),
        where('birth_month_day', '>=', startStr),
        where('birth_month_day', '<=', '12-31')
      )
      const q2 = query(
        clientsRef,
        where('is_active', '==', true),
        where('birth_month_day', '>=', '01-01'),
        where('birth_month_day', '<=', endStr)
      )
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)])
      snap1.forEach(doc => results.push({ id: doc.id, ...doc.data() } as Client))
      snap2.forEach(doc => results.push({ id: doc.id, ...doc.data() } as Client))
    }

    return { data: results, error: null }
  } catch (error) { 
    console.error("Erro em getClientsWithBirthdayThisWeek:", error)
    return { data: null, error } 
  }
}



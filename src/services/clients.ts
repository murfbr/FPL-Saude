import { db } from '@/lib/firebase'
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
} from 'firebase/firestore'
import { Client, ClientPackageWithDetails, ClientSubscription, Appointment, NoteEntry } from '@/types'
import { format, startOfMonth, endOfMonth, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { jsPDF } from 'jspdf'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'

const COMPANY_ID = 'fpl-saude'

export async function getClientsByProfessional(
  professionalId: string,
): Promise<{ data: Client[] | null; error: any }> {
  try {
    // No Firebase, procuramos os appointments do profissional
    const apptsRef = collection(db, 'companies', COMPANY_ID, 'appointments')
    const qAppts = query(apptsRef, where('professional_id', '==', professionalId))
    const apptsSnap = await getDocs(qAppts)

    if (apptsSnap.empty) return { data: [], error: null }

    // Pega IDs únicos de clientes
    const clientIds = [...new Set(apptsSnap.docs.map(doc => doc.data().client_id))]
    if (clientIds.length === 0) return { data: [], error: null }

    // No Firestore, 'in' aceita array de até 30 itens. Para simplificar no momento, faremos chamadas em lote simples.
    // O ideal futuro seria desnormalizar uma subcoleção no próprio professional.
    const clientsRef = collection(db, 'companies', COMPANY_ID, 'clients')
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
    const clientsRef = collection(db, 'companies', COMPANY_ID, 'clients')
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

export async function getClientById(
  clientId: string,
): Promise<{ data: Client | null; error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'clients', clientId)
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
    const clientsRef = collection(db, 'companies', COMPANY_ID, 'clients')
    const newDocRef = doc(clientsRef)
    const newClient = { id: newDocRef.id, ...clientData, is_active: true }

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
    const docRef = doc(db, 'companies', COMPANY_ID, 'clients', clientId)
    await updateDoc(docRef, updates)

    const snapshot = await getDoc(docRef)
    return { data: { id: snapshot.id, ...snapshot.data() } as Client, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function deleteClient(clientId: string): Promise<{ error: any }> {
  try {
    const docRef = doc(db, 'companies', COMPANY_ID, 'clients', clientId)
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
    const pkgsRef = collection(db, 'companies', COMPANY_ID, 'clients', clientId, 'packages')
    const snap = await getDocs(pkgsRef)

    const results = []
    for (const d of snap.docs) {
      const data = d.data()
      const cp = { id: d.id, ...data } as any
      if (data.package_id) {
        const pSnap = await getDoc(doc(db, 'companies', COMPANY_ID, 'packages', data.package_id))
        if (pSnap.exists()) {
          const pkgData = pSnap.data()
          let sData = null
          if (pkgData.service_id) {
            const sSnap = await getDoc(doc(db, 'companies', COMPANY_ID, 'services', pkgData.service_id))
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

export async function getAllActiveClientPackages(): Promise<{ data: any[] | null; error: any }> {
  try {
    const pkgsRef = collectionGroup(db, 'packages')
    const q = query(pkgsRef, where('sessions_remaining', '>', 0))
    const snap = await getDocs(q)

    const results = []
    for (const d of snap.docs) {
      const data = d.data()
      const cp = { id: d.id, ...data } as any
      // Hidratação de Cliente
      if (data.client_id) {
        const cSnap = await getDoc(doc(db, 'companies', COMPANY_ID, 'clients', data.client_id))
        if (cSnap.exists()) cp.clients = { id: cSnap.id, ...cSnap.data() }
      }
      // Hidratação de Pacote
      if (data.package_id) {
        const pSnap = await getDoc(doc(db, 'companies', COMPANY_ID, 'packages', data.package_id))
        if (pSnap.exists()) cp.packages = { id: pSnap.id, ...pSnap.data() }
      }
      results.push(cp)
    }
    return { data: results, error: null }
  } catch (error) {
    console.error("🔥 ERRO EM getAllActiveClientPackages (falta de índice?): ", error)
    return { data: null, error }
  }
}

export async function assignPackageToClient(clientId: string, packageId: string, sessions: number, purchaseDate?: Date, discountAmount: number = 0): Promise<{ error: any }> {
  try {
    const pkgsRef = collection(db, 'companies', COMPANY_ID, 'clients', clientId, 'packages')
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
    const docRef = doc(db, 'companies', COMPANY_ID, 'clients', clientId, 'packages', clientPackageId)
    await deleteDoc(docRef)
    return { error: null }
  } catch (error) { return { error } }
}

export async function getClientSubscriptions(clientId: string): Promise<{ data: any[] | null; error: any }> {
  try {
    const subsRef = collection(db, 'companies', COMPANY_ID, 'clients', clientId, 'subscriptions')
    const snap = await getDocs(subsRef)

    const results = []
    for (const d of snap.docs) {
      const data = d.data()
      const sub = { id: d.id, ...data } as any

      if (data.service_id) {
        const sSnap = await getDoc(doc(db, 'companies', COMPANY_ID, 'services', data.service_id))
        if (sSnap.exists()) sub.services = { id: sSnap.id, ...sSnap.data() }
      }
      if (data.subscription_plan_id) {
        const pSnap = await getDoc(doc(db, 'companies', COMPANY_ID, 'subscription_plans', data.subscription_plan_id))
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
    const subsRef = collection(db, 'companies', COMPANY_ID, 'clients', data.client_id, 'subscriptions')
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
export async function cancelClientSubscription(subId: string): Promise<{ error: any }> {
  return { error: null }
}
export async function exportClientData(clientId: string, exportType: string, formatType: 'pdf' | 'docx'): Promise<{ data: any | null; error: any }> {
  try {
    // 1. Buscando o nome do paciente
    const patientSnap = await getDoc(doc(db, 'companies', COMPANY_ID, 'clients', clientId))
    if (!patientSnap.exists()) {
      return { data: null, error: new Error('Paciente não encontrado') }
    }
    const patient = patientSnap.data()

    // 2. Buscando todas as consultas do paciente para agrupar as anotações
    const apptsRef = collection(db, 'companies', COMPANY_ID, 'appointments')
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
    const clientsRef = collection(db, 'companies', COMPANY_ID, 'clients')
    const q = query(clientsRef, where('is_active', '==', true))
    const snapshot = await getDocs(q)

    const results: Client[] = []

    snapshot.forEach(doc => {
      const data = doc.data()
      if (data.birth_date) {
        // Extract month and day
        const [, m, d] = data.birth_date.split('-')
        const birthDateThisYear = new Date(startDate.getFullYear(), parseInt(m) - 1, parseInt(d))

        // Cobre virada de ano e semanas que cruzam anos
        if (birthDateThisYear >= startDate && birthDateThisYear <= endDate) {
          results.push({ id: doc.id, ...data } as Client)
        } else {
          const birthDateNextYear = new Date(startDate.getFullYear() + 1, parseInt(m) - 1, parseInt(d))
          if (birthDateNextYear >= startDate && birthDateNextYear <= endDate) {
            results.push({ id: doc.id, ...data } as Client)
          }
        }
      }
    })

    return { data: results, error: null }
  } catch (error) { return { data: null, error } }
}
export async function getMonthlyClientUsage(clientId: string, serviceId: string): Promise<{ count: number; error: any }> {
  return { count: 0, error: null }
}


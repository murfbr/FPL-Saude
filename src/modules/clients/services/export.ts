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
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { jsPDF } from 'jspdf'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx'

export async function exportClientData(clientId: string, exportType: string, formatType: 'pdf' | 'docx'): Promise<{ data: any | null; error: any }> {
  try {
    // 1. Buscando o nome do paciente
    const patientSnap = await getDoc(doc(db, 'companies', getCompanyId(), 'clients', clientId))
    if (!patientSnap.exists()) {
      return { data: null, error: new Error('Paciente não encontrado') }
    }
    const patient = patientSnap.data()

    // 2. Buscando notas da nova subcoleção
    const notesRef = collection(db, 'companies', getCompanyId(), 'clients', clientId, 'notes')
    const qNotes = query(notesRef, orderBy('date', 'desc'))
    const notesSnap = await getDocs(qNotes)

    let allNotes: NoteEntry[] = []
    notesSnap.forEach(doc => {
      allNotes.push(doc.data() as NoteEntry)
    })

    // Fallback temporário para não perder nada ainda não migrado em appointments
    const apptsRef = collection(db, 'companies', getCompanyId(), 'appointments')
    const qAppts = query(apptsRef, where('client_id', '==', clientId))
    const apptsSnap = await getDocs(qAppts)

    apptsSnap.forEach(doc => {
      const data = doc.data()
      if (data.notes && Array.isArray(data.notes)) {
        data.notes.forEach(legacyNote => {
          if (!allNotes.some(n => n.date === legacyNote.date)) {
            allNotes.push(legacyNote)
          }
        })
      }
    })

    // 3.5 Buscando Avaliação Geral
    const assessmentEntry = Array.isArray(patient.general_assessment)
      ? patient.general_assessment.find((i: any) => i.type === 'assessment' || !i.type)
      : (patient.general_assessment?.type === 'assessment' ? patient.general_assessment : null)

    // Incluir histórico importado legado (antes da migração)
    if (patient.general_assessment && Array.isArray(patient.general_assessment)) {
      patient.general_assessment.forEach((entry: any) => {
        if (entry.type === 'imported_history') {
          if (!allNotes.some(n => n.date === entry.date && n.content === entry.content)) {
            allNotes.push({
              date: entry.date,
              content: entry.content || '',
              professional_name: 'Histórico Importado',
              type: 'imported_history'
            })
          }
        }
      })
    }

    // Sort novamente
    allNotes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    if (allNotes.length === 0 && !assessmentEntry) {
      return { data: null, error: new Error('O paciente não possui anotações nem avaliação para exportar.') }
    }

    const reportDate = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
    const sanitizedName = (patient.name || 'Paciente').replace(/[^a-zA-Z0-9_-]/g, '_')
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

      if (assessmentEntry) {
        doc.setFont('helvetica', 'bold')
        doc.text('Avaliação Geral / Ficha do Paciente', 15, yOffset)
        yOffset += 8
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)

        const data = assessmentEntry
        const lines = []
        if (data.mainComplaint) lines.push(`Queixa Principal: ${data.mainComplaint}`)
        if (data.profession) lines.push(`Profissão: ${data.profession}`)
        if (data.physicalActivity) lines.push(`Atividade Física: ${data.physicalActivity}`)
        if (data.clinicalDiagnosis) lines.push(`Diagnóstico Clínico: ${data.clinicalDiagnosis}`)
        if (data.historyOfPresentIllness) lines.push(`HDA: ${data.historyOfPresentIllness}`)
        if (data.pastMedicalHistory) lines.push(`HPP: ${data.pastMedicalHistory}`)
        if (data.medications) lines.push(`Medicamentos: ${data.medications}`)
        if (data.physicalExam) lines.push(`Exame Físico: ${data.physicalExam}`)
        if (data.diagnosis) lines.push(`Diagnóstico Cinético-Funcional: ${data.diagnosis}`)
        if (data.treatmentPlan) lines.push(`Plano de Tratamento: ${data.treatmentPlan}`)

        const splitText = doc.splitTextToSize(lines.join('\n'), pageWidth - 30)
        doc.text(splitText, 15, yOffset)
        yOffset += (splitText.length * 5) + 10
        doc.line(15, yOffset, pageWidth - 15, yOffset)
        yOffset += 10
        doc.setFontSize(12)
      }

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

        const safeContent = note.content ? String(note.content) : 'Sem anotação'
        // Split text para não vazar a folha A4
        const splitText = doc.splitTextToSize(safeContent, pageWidth - 30)

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

      // 4.5 Avaliação Geral no DOCX
      if (assessmentEntry) {
        docxSections.push(
          new Paragraph({
            text: "Avaliação Geral / Ficha do Paciente",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          })
        )

        const data = assessmentEntry
        const assessmentLines = []
        if (data.mainComplaint) assessmentLines.push(`Queixa Principal: ${data.mainComplaint}`)
        if (data.profession) assessmentLines.push(`Profissão: ${data.profession}`)
        if (data.physicalActivity) assessmentLines.push(`Atividade Física: ${data.physicalActivity}`)
        if (data.clinicalDiagnosis) assessmentLines.push(`Diagnóstico Clínico: ${data.clinicalDiagnosis}`)
        if (data.historyOfPresentIllness) assessmentLines.push(`HDA: ${data.historyOfPresentIllness}`)
        if (data.pastMedicalHistory) assessmentLines.push(`HPP: ${data.pastMedicalHistory}`)
        if (data.medications) assessmentLines.push(`Medicamentos: ${data.medications}`)
        if (data.physicalExam) assessmentLines.push(`Exame Físico: ${data.physicalExam}`)
        if (data.diagnosis) assessmentLines.push(`Diagnóstico Cinético-Funcional: ${data.diagnosis}`)
        if (data.treatmentPlan) assessmentLines.push(`Plano de Tratamento: ${data.treatmentPlan}`)

        assessmentLines.forEach(line => {
          docxSections.push(
            new Paragraph({
              text: line,
              spacing: { after: 100 }
            })
          )
        })

        docxSections.push(new Paragraph({ text: "", border: { bottom: { color: "auto", space: 1, style: BorderStyle.SINGLE, size: 6 } }, spacing: { after: 300 } }))
      }

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
            text: note.content ? String(note.content) : 'Sem anotação',
            spacing: { after: 300 }
          })
        )
      }

      const docxDocument = new Document({
        creator: "Sistema",
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

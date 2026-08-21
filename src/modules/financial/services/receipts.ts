import { db, storage } from '@/shared/lib/firebase'
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { Receipt, ReceiptItem, Appointment } from '@/shared/types'
import { getCompanyId } from '@/shared/lib/tenantStore'
import { uploadFile } from '@/shared/lib/storage'
import { getDownloadURL, ref, deleteObject } from 'firebase/storage'
import jsPDF from 'jspdf'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getClientSubscriptions } from '@/modules/clients/services/subscriptions'
import { dayKeyOf, spDayStartUtc, spDayEndUtc } from '@/shared/lib/spTime'

export async function getActivitiesForReceipt(
  clientId: string,
  startDate: string,
  endDate: string,
): Promise<{ data: ReceiptItem[] | null; error: any }> {
  try {
    const companyId = getCompanyId()
    const apptsRef = collection(db, 'companies', companyId, 'appointments')
    const q = query(
      apptsRef,
      where('client_id', '==', clientId),
      where('status', 'in', ['completed', 'no_show']),
    )

    const snap = await getDocs(q)
    const appointments: Appointment[] = []

    snap.forEach((d) => {
      const data = d.data() as Appointment
      const apptDay = data.schedules?.start_time
        ? dayKeyOf(data.schedules.start_time)
        : null
      if (apptDay && apptDay >= startDate && apptDay <= endDate) {
        appointments.push({ id: d.id, ...data })
      }
    })

    // Fetch subscriptions properly hydrated
    const { data: clientSubsData } = await getClientSubscriptions(clientId)
    const clientSubs = clientSubsData || []

    // Fetch financial records in the period to get actual paid amounts
    const finRef = collection(db, 'companies', companyId, 'financial_records')
    const finQ = query(
      finRef,
      where('client_id', '==', clientId),
      where('payment_date', '>=', spDayStartUtc(startDate)),
      where('payment_date', '<=', spDayEndUtc(endDate)),
    )
    const finSnap = await getDocs(finQ)
    const financialRecords = finSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as any,
    )

    // Helper functions to find payments
    const getPackagePayments = (pkgId: string) =>
      financialRecords.filter((f) => f.client_package_id === pkgId)
    const getSubscriptionPayments = (subId: string) =>
      financialRecords.filter((f) => f.client_subscription_id === subId)
    const getAvulsoPayment = (apptId: string) =>
      financialRecords.find((f) => f.appointment_id === apptId)

    // Map items
    const itemsMap = new Map<string, ReceiptItem>()
    const avulsos: ReceiptItem[] = []

    for (const appt of appointments) {
      const isPackage = !!appt.client_package_id
      let isSubscription = false
      let matchingSub: any = null

      if (!isPackage) {
        const serviceId = appt.service_id || appt.services?.id
        matchingSub = clientSubs.find((sub) => sub.service_id === serviceId)
        if (matchingSub || appt.services?.value_type === 'monthly') {
          isSubscription = true
        }
      }

      const apptDateStr = appt.schedules?.start_time
        ? format(new Date(appt.schedules.start_time), 'dd/MM/yyyy')
        : ''
      const apptDesc = appt.services?.name || 'Sessão'

      if (isPackage && appt.client_package_id) {
        const pkgId = appt.client_package_id
        if (!itemsMap.has(pkgId)) {
          // Fetch package details
          const pkgRef = doc(
            db,
            'companies',
            companyId,
            'clients',
            clientId,
            'packages',
            pkgId,
          )
          const pkgSnap = await getDoc(pkgRef)
          let pkgName = 'Pacote'
          let isPrePeriod = false

          let pkgPrice = 0
          const pkgPayments = getPackagePayments(pkgId)
          if (pkgPayments.length > 0) {
            pkgPrice = pkgPayments.reduce((sum, p) => sum + p.amount, 0)
          }

          if (pkgSnap.exists()) {
            const pkgData = pkgSnap.data()

            const purchaseDate = pkgData.purchase_date
            if (purchaseDate && purchaseDate < startDate) {
              isPrePeriod = true
            }
            if (pkgData.package_id) {
              try {
                const pSnap = await getDoc(
                  doc(
                    db,
                    'companies',
                    companyId,
                    'packages',
                    pkgData.package_id,
                  ),
                )
                if (pSnap.exists()) {
                  pkgName = pSnap.data().name
                  // Pacote pago fora do período: o preço vem do catálogo (menos
                  // desconto do cliente) — o doc do cliente não guarda price
                  if (pkgPrice === 0) {
                    pkgPrice = Math.max(
                      0,
                      (pSnap.data().price || 0) -
                        (pkgData.discount_amount || 0),
                    )
                  }
                }
              } catch (e) {}
            }
          }

          itemsMap.set(pkgId, {
            id: pkgId,
            type: 'package',
            description: `Pacote: ${pkgName}`,
            amount: pkgPrice,
            isPrePeriod,
            subItems: [],
          })
        }
        itemsMap
          .get(pkgId)!
          .subItems!.push({ date: apptDateStr, description: apptDesc })
      } else if (isSubscription && matchingSub) {
        const subId = matchingSub.id
        if (!itemsMap.has(subId)) {
          // Find actual payments in the period
          const subPayments = getSubscriptionPayments(subId)
          const totalPaid = subPayments.reduce((sum, p) => sum + p.amount, 0)

          const isUnpaid = totalPaid === 0

          let subName =
            matchingSub.subscription_plans?.name ||
            matchingSub.services?.name ||
            'Assinatura'

          itemsMap.set(subId, {
            id: subId,
            type: 'subscription',
            description: `Assinatura: ${subName}`,
            amount: totalPaid,
            isUnpaid, // Nova flag
            subItems: [],
          })
        }
        itemsMap
          .get(subId)!
          .subItems!.push({ date: apptDateStr, description: apptDesc })
      } else {
        // Avulso
        const payment = getAvulsoPayment(appt.id)
        let finalPrice = payment ? payment.amount : 0
        let isUnpaid = false

        if (!payment) {
          const price = appt.services?.price || 0
          const discount = appt.discount_amount || 0
          finalPrice = Math.max(0, price - discount)
          isUnpaid = finalPrice > 0 // if it has a price but no payment found
        }

        avulsos.push({
          id: appt.id,
          type: 'avulso',
          description: apptDesc,
          amount: finalPrice,
          date: apptDateStr,
          isUnpaid,
        })
      }
    }

    const groupedItems = Array.from(itemsMap.values())
    const results = [...avulsos, ...groupedItems]

    return { data: results, error: null }
  } catch (error) {
    console.error('Erro ao buscar atividades para o recibo:', error)
    return { data: null, error }
  }
}

export async function saveReceipt(
  clientId: string,
  receiptData: Omit<Receipt, 'id' | 'created_at' | 'file_url' | 'file_path'>,
  pdfBlob: Blob,
): Promise<{ data: Receipt | null; error: any }> {
  try {
    const companyId = getCompanyId()
    const timestamp = new Date().getTime()
    const filePath = `companies/${companyId}/financial/receipts/${clientId}_${timestamp}.pdf`
    const bucket =
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
      'fpl-saude.firebasestorage.app'

    const { data: uploadSnap, error: uploadError } = await uploadFile(
      bucket,
      filePath,
      pdfBlob as File,
    )
    if (uploadError) throw uploadError

    const fileUrl = await getDownloadURL(uploadSnap.ref)

    const docsRef = collection(
      db,
      'companies',
      companyId,
      'clients',
      clientId,
      'receipts',
    )
    const newDoc = doc(docsRef)

    const newReceipt: Receipt = {
      id: newDoc.id,
      ...receiptData,
      file_url: fileUrl,
      file_path: filePath,
      created_at: new Date().toISOString(),
    }

    await setDoc(newDoc, newReceipt)
    return { data: newReceipt, error: null }
  } catch (error) {
    console.error('Erro ao salvar recibo: ', error)
    return { data: null, error }
  }
}

export async function getClientReceipts(
  clientId: string,
): Promise<{ data: Receipt[] | null; error: any }> {
  try {
    const docsRef = collection(
      db,
      'companies',
      getCompanyId(),
      'clients',
      clientId,
      'receipts',
    )
    const q = query(docsRef, orderBy('created_at', 'desc'))
    const snap = await getDocs(q)
    const receipts: Receipt[] = []
    snap.forEach((d) => {
      receipts.push({ id: d.id, ...d.data() } as Receipt)
    })
    return { data: receipts, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export const generateReceiptPDF = (
  receipt: Receipt,
  clientName: string,
  clientCpf?: string,
  companyCnpj?: string,
  companySubtitle?: string,
) => {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Borda da página
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.5)
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20)

  // Cabeçalho (Timbre)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 64, 175) // Azul primário
  doc.text('FPL Saúde', pageWidth / 2, 25, { align: 'center' })

  // Subtítulo do cabeçalho
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(companySubtitle || 'Clínica de Especialidades', pageWidth / 2, 32, {
    align: 'center',
  })

  if (companyCnpj) {
    doc.setFontSize(9)
    doc.text(`CNPJ: ${companyCnpj}`, pageWidth / 2, 37, { align: 'center' })
  }

  // Linha separadora do cabeçalho
  doc.setDrawColor(200, 200, 200)
  const lineY = companyCnpj ? 41 : 38
  doc.line(20, lineY, pageWidth - 20, lineY)

  // Título do Documento
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('RECIBO DE PRESTAÇÃO DE SERVIÇOS', pageWidth / 2, lineY + 12, {
    align: 'center',
  })

  // Corpo do Texto
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val)

  const startDateStr = format(new Date(receipt.start_date), 'dd/MM/yyyy')
  const endDateStr = format(new Date(receipt.end_date), 'dd/MM/yyyy')

  const cpfStr =
    clientCpf && clientCpf.length === 11
      ? `, portador do CPF ${clientCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`
      : ''

  const content = `Recebemos de ${clientName}${cpfStr}, a importância de ${formatCurrency(
    receipt.total_amount,
  )} referente à prestação de serviços de saúde no período de ${startDateStr} a ${endDateStr}, conforme detalhado abaixo:`

  const textLines = doc.splitTextToSize(content, pageWidth - 40)
  const contentY = lineY + 32
  doc.text(textLines, 20, contentY)

  let currentY = contentY + textLines.length * 7

  // Detalhamento dos serviços
  doc.setFontSize(10)
  receipt.items.forEach((item) => {
    if (currentY > pageHeight - 60) {
      doc.addPage()
      currentY = 20
    }

    doc.setFont('helvetica', 'bold')
    const mainLine = item.date
      ? `${item.date} - ${item.description}`
      : item.description
    doc.text(mainLine, 20, currentY)
    doc.text(formatCurrency(item.amount), pageWidth - 20, currentY, {
      align: 'right',
    })
    currentY += 6

    if (item.subItems && item.subItems.length > 0) {
      doc.setFont('helvetica', 'normal')
      item.subItems.forEach((subItem) => {
        if (currentY > pageHeight - 60) {
          doc.addPage()
          currentY = 20
        }
        doc.text(`- ${subItem.date} : ${subItem.description}`, 25, currentY)
        currentY += 5
      })
      currentY += 2
    } else {
      currentY += 2
    }
  })

  // Total
  currentY += 5
  doc.setDrawColor(200, 200, 200)
  doc.line(20, currentY, pageWidth - 20, currentY)
  currentY += 8

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL:', 20, currentY)
  doc.text(formatCurrency(receipt.total_amount), pageWidth - 20, currentY, {
    align: 'right',
  })

  // Rodapé / Assinatura
  doc.setDrawColor(0, 0, 0)
  doc.line(
    pageWidth / 2 - 40,
    pageHeight - 50,
    pageWidth / 2 + 40,
    pageHeight - 50,
  ) // Linha de assinatura

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(receipt.professional_name, pageWidth / 2, pageHeight - 42, {
    align: 'center',
  })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Data de Emissão: ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
    pageWidth / 2,
    pageHeight - 34,
    { align: 'center' },
  )

  return doc
}

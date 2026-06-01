/**
 * Script para limpar pagamentos duplicados de assinaturas
 * 
 * Uso:
 *   npx tsx scripts/clean_duplicate_payments.ts
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const projectId = process.env.VITE_FIREBASE_PROJECT_ID
if (!projectId) {
  console.error('❌ VITE_FIREBASE_PROJECT_ID não encontrado no .env.local')
  process.exit(1)
}

// Inicializar com Application Default Credentials
initializeApp({ projectId })
const db = getFirestore()

async function main() {
  console.log(`\n🔥 Iniciando limpeza de duplicidades — Projeto: ${projectId}\n`)

  const companiesSnap = await db.collection('companies').get()
  const companies = companiesSnap.docs.map(d => d.id)

  for (const companyId of companies) {
    console.log(`\n🏢 Processando empresa: ${companyId}`)
    const finRef = db.collection('companies').doc(companyId).collection('financial_records')
    
    // Pegar apenas pagamentos de assinaturas
    const snapshot = await finRef.where('client_subscription_id', '!=', null).get()
    
    if (snapshot.empty) {
      console.log('  Nenhum registro encontrado.')
      continue
    }

    const groupedPayments: Record<string, Record<string, any[]>> = {}

    snapshot.forEach(doc => {
      const data = doc.data()
      if (!data.payment_date || !data.client_subscription_id) return

      const subId = data.client_subscription_id
      const monthYear = data.payment_date.substring(0, 7) // "YYYY-MM"

      if (!groupedPayments[subId]) groupedPayments[subId] = {}
      if (!groupedPayments[subId][monthYear]) groupedPayments[subId][monthYear] = []

      groupedPayments[subId][monthYear].push({ id: doc.id, ...data })
    })

    let duplicateCount = 0

    for (const [subId, months] of Object.entries(groupedPayments)) {
      for (const [monthYear, records] of Object.entries(months)) {
        if (records.length > 1) {
          // Ordena para manter o registro mais antigo
          records.sort((a, b) => a.payment_date.localeCompare(b.payment_date))
          const [keep, ...duplicates] = records
          
          console.log(`  [Assinatura ${subId} | ${monthYear}] Encontrados ${records.length}. Removendo ${duplicates.length}...`)
          
          for (const dup of duplicates) {
            console.log(`    -> Removendo ${dup.id} (R$ ${dup.amount})`)
            await finRef.doc(dup.id).delete()
            duplicateCount++
          }
        }
      }
    }
    
    console.log(`  ✅ Concluído para empresa ${companyId}. ${duplicateCount} registros removidos.`)
  }

  console.log('\n✅ Script finalizado com sucesso!\n')
  process.exit(0)
}

main().catch(err => {
  console.error('❌ Erro no script:', err)
  process.exit(1)
})

/**
 * Backfill Service Observation Requirement
 * 
 * Sincroniza a flag 'requires_observation' dos serviços nos agendamentos (documentos denormalizados).
 * 
 * Uso:
 *   npx tsx scripts/backfill-requires-observation.ts
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const projectId = process.env.VITE_FIREBASE_PROJECT_ID
if (!projectId) {
  console.error('❌ VITE_FIREBASE_PROJECT_ID não encontrado no .env.local')
  process.exit(1)
}

initializeApp({ projectId })
const db = getFirestore()

async function main() {
  console.log(`\n🔥 Backfill Requires Observation — Projeto: ${projectId}\n`)

  const companiesSnap = await db.collection('companies').get()
  const companies = companiesSnap.docs.map((d) => d.id)
  console.log(`📋 Empresas encontradas: ${companies.join(', ')}\n`)

  for (const companyId of companies) {
    console.log(`\n🏢 Processando empresa: ${companyId}`)

    // 1. Mapear Requisitos dos Serviços
    const servicesSnap = await db.collection('companies').doc(companyId).collection('services').get()
    const serviceRequirements = new Map<string, boolean>()
    
    servicesSnap.forEach(doc => {
      const data = doc.data()
      // Default to true if not specified
      serviceRequirements.set(doc.id, data.requires_observation !== false)
    })

    console.log(`   🛠️  ${serviceRequirements.size} serviços mapeados.`)

    // 2. Buscar agendamentos
    const apptsSnap = await db.collection('companies').doc(companyId).collection('appointments').get()
    console.log(`   📅 ${apptsSnap.size} agendamentos encontrados.`)

    let updatedCount = 0
    const batchSize = 500
    let currentBatch = db.batch()
    let opCount = 0

    for (const docSnap of apptsSnap.docs) {
      const appt = docSnap.data()
      const serviceId = appt.service_id
      if (!serviceId) continue

      const requirement = serviceRequirements.get(serviceId) ?? true
      
      // Só atualiza se for diferente ou se estiver faltando
      if (appt.services?.requires_observation !== requirement) {
        currentBatch.update(docSnap.ref, {
          'services.requires_observation': requirement
        })
        opCount++
        updatedCount++

        if (opCount >= batchSize) {
          await currentBatch.commit()
          currentBatch = db.batch()
          opCount = 0
        }
      }
    }

    if (opCount > 0) {
      await currentBatch.commit()
    }

    console.log(`   ✅ ${updatedCount} agendamentos atualizados.`)
  }

  console.log('\n✨ Backfill concluído!\n')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Erro no backfill:', err)
  process.exit(1)
})

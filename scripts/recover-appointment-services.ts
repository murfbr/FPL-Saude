/**
 * Recover Appointment Services
 * 
 * Restaura o objeto 'services' denormalizado em agendamentos que perderam o nome/duração/preço.
 * 
 * Uso:
 *   npx tsx scripts/recover-appointment-services.ts
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
  console.log(`\n🚑 Recuperando Dados de Agendamentos — Projeto: ${projectId}\n`)

  const companiesSnap = await db.collection('companies').get()
  const companies = companiesSnap.docs.map((d) => d.id)

  for (const companyId of companies) {
    if (companyId !== 'fpl-saude') continue; // Focar na afetada
    console.log(`\n🏢 Empresa: ${companyId}`)

    // 1. Mapear Serviços Atuais
    const servicesSnap = await db.collection('companies').doc(companyId).collection('services').get()
    const servicesMap = new Map<string, any>()
    
    servicesSnap.forEach(doc => {
      servicesMap.set(doc.id, { id: doc.id, ...doc.data() })
    })

    console.log(`   🛠️  ${servicesMap.size} serviços carregados.`)

    // 2. Buscar agendamentos corrompidos
    const apptsSnap = await db.collection('companies').doc(companyId).collection('appointments').get()
    
    let recoveredCount = 0
    const batchSize = 500
    let currentBatch = db.batch()
    let opCount = 0

    for (const docSnap of apptsSnap.docs) {
      const appt = docSnap.data()
      const serviceId = appt.service_id || appt.services?.id
      
      if (serviceId) {
        const serviceData = servicesMap.get(serviceId)
        
        if (serviceData) {
          const requirement = serviceData.requires_observation !== false
          
          // Se o objeto services estiver incompleto OU o requires_observation estiver errado/faltando
          if (!appt.services?.name || appt.services.requires_observation !== requirement) {
            const restoredServices = {
              id: serviceData.id,
              name: serviceData.name,
              duration_minutes: serviceData.duration_minutes || 60,
              price: serviceData.price || 0,
              value_type: serviceData.value_type || 'session',
              requires_observation: requirement
            }

            currentBatch.update(docSnap.ref, {
              services: restoredServices
            })
            
            opCount++
            recoveredCount++
          }
        }
      }

      if (opCount >= batchSize) {
        await currentBatch.commit()
        console.log(`   ⏲️  Batch enviado...`)
        currentBatch = db.batch()
        opCount = 0
      }
    }

    if (opCount > 0) {
      await currentBatch.commit()
    }

    console.log(`   ✅ ${recoveredCount} agendamentos restaurados.`)
  }

  console.log('\n✨ Recuperação concluída!\n')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Erro na recuperação:', err)
  process.exit(1)
})

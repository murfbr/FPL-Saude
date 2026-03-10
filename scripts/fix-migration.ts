import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const MAIN_COMPANY_ID = 'fpl-saude'

async function runPatch() {
  console.log('🚀 Iniciando PATCH de Migração: Denormalização de Datas e Injeção de Pacotes')

  const serviceAccount = JSON.parse(fs.readFileSync('./firebase-service-account.json', 'utf8'))
  initializeApp({ credential: cert(serviceAccount) })
  const db = getFirestore()

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const supabase = createClient(supabaseUrl!, supabaseKey!)

  const companyRef = db.collection('companies').doc(MAIN_COMPANY_ID)

  // --- COMPLEMENTO 1: Migrar Pacotes ---
  console.log('\n⏳ Importando Pacotes de Serviço...')
  const { data: packages } = await supabase.from('packages').select('*')
  if (packages) {
    const batch = db.batch()
    const packRef = companyRef.collection('packages')
    for (const p of packages) batch.set(packRef.doc(p.id), p)
    await batch.commit()
    console.log(`✅ ${packages.length} Pacotes migrados para o Firestore.`)
  }

  // --- COMPLEMENTO 2: Migrar Subscription Plans ---
  console.log('\n⏳ Importando Planos de Assinatura...')
  const { data: plans } = await supabase.from('subscription_plans').select('*')
  if (plans) {
    const batch = db.batch()
    const plansRef = companyRef.collection('subscription_plans')
    for (const p of plans) batch.set(plansRef.doc(p.id), p)
    await batch.commit()
    console.log(`✅ ${plans.length} Planos de Assinatura migrados.`)
  }

  // --- COMPLEMENTO 3: Migrar Client Packages Actives (Optional but useful) ---
  const { data: clientPkgs } = await supabase.from('client_packages').select('*')
  if (clientPkgs) {
     const batch = db.batch()
     const cpRef = companyRef.collection('client_packages')
     for(const cp of clientPkgs) batch.set(cpRef.doc(cp.id), cp)
     await batch.commit()
     console.log(`✅ ${clientPkgs.length} Associacões de Pacotes-Clientes migradas.`)
  }

  // --- COMPLEMENTO 4: Migrar Client Subscriptions Actives ---
  const { data: clientSubs } = await supabase.from('client_subscriptions').select('*')
  if (clientSubs) {
     const batch = db.batch()
     const subsRef = companyRef.collection('client_subscriptions')
     for(const cs of clientSubs) batch.set(subsRef.doc(cs.id), cs)
     await batch.commit()
     console.log(`✅ ${clientSubs.length} Assinaturas Ativas de Clientes migradas.`)
  }

  // --- COMPLEMENTO 5: Desnormalizar Data dos Agendamentos ---
  console.log('\n⏳ Cruzando Agendamentos com Schedules para encontrar as Datas Originais...')
  const { data: appointments } = await supabase.from('appointments').select('id, schedule_id')
  const { data: schedules } = await supabase.from('schedules').select('id, start_time, end_time')

  if (appointments && schedules) {
    const batch = db.batch()
    let updatedCount = 0

    // Cria um mapa rápido de Schedules na memória
    const scheduleMap = new Map()
    for (const s of schedules) {
      scheduleMap.set(s.id, { start_time: s.start_time, end_time: s.end_time })
    }

    const apptsRef = companyRef.collection('appointments')
    
    // Processamento em blocos (Firestore batch limit = 500)
    let opsCount = 0
    let currentBatch = db.batch()

    for (const a of appointments) {
      if (a.schedule_id) {
        const timeData = scheduleMap.get(a.schedule_id)
        if (timeData) {
          // Atualiza o documento no Firestore colando o "schedules" embutido
          currentBatch.update(apptsRef.doc(a.id), { schedules: timeData })
          updatedCount++
          opsCount++
        }
      }

      // Se bater 450, commita e abre novo batch pra n dar erro de limite
      if (opsCount >= 450) {
        await currentBatch.commit()
        currentBatch = db.batch()
        opsCount = 0
      }
    }
    
    // Commita os remanescentes
    if (opsCount > 0) {
      await currentBatch.commit()
    }

    console.log(`✅ ${updatedCount} Agendamentos foram 'Hidratados' com seu StartTime/EndTime original!`)
  }


  console.log('\n🎉 Patch concluído! O Banco NoSQL agora está com referências completas!')
}

runPatch().catch(console.error)

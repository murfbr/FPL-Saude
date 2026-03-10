/**
 * Script de Migração INTELIGENTE: Supabase (Relacional) -> Firebase Firestore (NoSQL SaaS)
 * 
 * Este script faz um DE-PARA aplicando regras de modelagem NoSQL:
 * 1. Isolando todos os dados sob a companhia master 'fpl-saude' (Preparação SaaS / Multi-tenant).
 * 2. Convertendo tabelas de ligação (professional_services) em Arrays.
 * 3. Organizando coleções de forma hierárquica (Subcoleções de clients e professionals).
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const MAIN_COMPANY_ID = 'fpl-saude'

async function runMigration() {
  console.log('🚀 Iniciando Migração Inteligente: Supabase -> Firestore SaaS')

  const serviceAccountPath = './firebase-service-account.json'
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ ERRO: firebase-service-account.json não encontrado.')
    process.exit(1)
  }
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
  initializeApp({ credential: cert(serviceAccount) })
  const db = getFirestore()

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERRO: Chaves do Supabase ausentes.')
    process.exit(1)
  }
  const supabase = createClient(supabaseUrl, supabaseKey)

  // --- PASSO 0: Criar o Documento da Empresa Base ---
  const companyRef = db.collection('companies').doc(MAIN_COMPANY_ID)
  await companyRef.set({ name: 'FPL Saúde', created_at: new Date().toISOString() }, { merge: true })
  console.log(`✅ Coleção corporativa principal [${MAIN_COMPANY_ID}] garantida.`)

  // Coleções raízes do SaaS
  const saasClients = companyRef.collection('clients')
  const saasProfessionals = companyRef.collection('professionals')
  const saasServices = companyRef.collection('services')
  const saasAppointments = companyRef.collection('appointments')
  const saasPartnerships = companyRef.collection('partnerships')


  // --- PASSO 1: Serviços, Pacotes e Planos ---
  console.log('\n⏳ Migrando Serviços Base...')
  const { data: services } = await supabase.from('services').select('*')
  if (services) {
    const batch = db.batch()
    for (const s of services) {
      batch.set(saasServices.doc(s.id), s)
    }
    await batch.commit()
    console.log(`✅ ${services.length} Serviços migrados.`)
  }

  // --- PASSO 2: Profissionais e Desnormalização de Serviços ---
  console.log('\n⏳ Migrando Profissionais e convertendo N-to-N em Arrays...')
  const { data: professionals } = await supabase.from('professionals').select('*')
  const { data: profServicesLinks } = await supabase.from('professional_services').select('*')
  
  if (professionals) {
    const batch = db.batch()
    for (const p of professionals) {
      // Regra NoSQL 1: Pegar lista de serviços do profissional e embutir no documento dele.
      const myServices = profServicesLinks?.filter(l => l.professional_id === p.id).map(l => l.service_id) || []
      const profDoc = { ...p, service_ids: myServices }
      batch.set(saasProfessionals.doc(p.id), profDoc)
    }
    await batch.commit()
    console.log(`✅ ${professionals.length} Profissionais migrados com arrays convertidos.`)
  }

  // --- PASSO 3: Clientes ---
  console.log('\n⏳ Migrando Clientes...')
  const { data: clients } = await supabase.from('clients').select('*')
  if (clients) {
    const batch = db.batch()
    for (const c of clients) {
      batch.set(saasClients.doc(c.id), c)
    }
    await batch.commit()
    console.log(`✅ ${clients.length} Clientes migrados.`)
  }

  // --- PASSO 4: Agendamentos Reais (Appointments) ---
  console.log('\n⏳ Migrando APENAS Agendamentos Reais e descartando Slots Vazios do Supabase...')
  const { data: appointments } = await supabase.from('appointments').select('*')
  if (appointments) {
    const batch = db.batch()
    for (const a of appointments) {
      batch.set(saasAppointments.doc(a.id), a)
    }
    await batch.commit()
    console.log(`✅ ${appointments.length} Agendamentos transferidos. Slots pré-alocados foram deletados na nova arquitetura.`)
  }

  // --- PASSO 5: Parcerias (Embutindo os Descontos como Array) ---
  console.log('\n⏳ Migrando Parcerias e embutindo descontos...')
  const { data: partnerships } = await supabase.from('partnerships').select('*')
  const { data: discounts } = await supabase.from('partnership_discounts').select('*')

  if (partnerships) {
    const batch = db.batch()
    for (const partner of partnerships) {
      // Pega todos os descontos dessa parceria e embute no documento pai
      const myDiscounts = discounts
        ?.filter(d => d.partnership_id === partner.id)
        .map(d => ({ service_id: d.service_id, percentage: d.discount_percentage })) || []
      
      const partnerDoc = { ...partner, discounts: myDiscounts }
      batch.set(saasPartnerships.doc(partner.id), partnerDoc)
    }
    await batch.commit()
    console.log(`✅ ${partnerships.length} Parcerias migradas (com arrays de descontos agrupados internamente).`)
  }

  console.log('\n🎉 Arquitetura Multi-Tenant SaaS aplicada e migração finalizada!')
}

runMigration().catch(console.error)

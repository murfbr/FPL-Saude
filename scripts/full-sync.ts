import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const MAIN_COMPANY_ID = 'fpl-saude'

async function fetchAll(supabase: any, table: string, select = '*') {
  let allData: any[] = []
  let from = 0
  const step = 999
  
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + step)
    
    if (error) throw error
    if (!data || data.length === 0) break
    allData = allData.concat(data)
    if (data.length <= step) break
    from += step + 1
  }
  return allData
}

async function runSync() {
  console.log('🚀 Iniciando Sincronização Absoluta Paginação (> 1000 rows)')
  
  const serviceAccountPath = './firebase-service-account.json'
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
  initializeApp({ credential: cert(serviceAccount) })
  const db = getFirestore()

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const supabase = createClient(supabaseUrl!, supabaseKey!)
  
  const companyRef = db.collection('companies').doc(MAIN_COMPANY_ID)

  // 1. SERVICES
  const services = await fetchAll(supabase, 'services')
  console.log(`\nBaixados ${services.length} services...`)
  let b = db.batch()
  for(const s of services) b.set(companyRef.collection('services').doc(s.id), s)
  await b.commit()

  // 2. PACKAGES & SUBS
  const packages = await fetchAll(supabase, 'packages')
  console.log(`Baixados ${packages.length} packages...`)
  b = db.batch()
  for(const p of packages) b.set(companyRef.collection('packages').doc(p.id), p)
  await b.commit()

  const plans = await fetchAll(supabase, 'subscription_plans')
  console.log(`Baixados ${plans.length} subscription_plans...`)
  b = db.batch()
  for(const p of plans) b.set(companyRef.collection('subscription_plans').doc(p.id), p)
  await b.commit()

  // 3. PARTNERSHIPS
  const partnerships = await fetchAll(supabase, 'partnerships')
  const discounts = await fetchAll(supabase, 'partnership_discounts')
  console.log(`Baixados ${partnerships.length} partnerships e ${discounts.length} discounts...`)
  
  b = db.batch()
  for (const partner of partnerships) {
    const myDiscounts = discounts
      .filter(d => d.partnership_id === partner.id)
      .map(d => ({ service_id: d.service_id, percentage: d.discount_percentage }))
    b.set(companyRef.collection('partnerships').doc(partner.id), { ...partner, discounts: myDiscounts })
  }
  await b.commit()
  
  // 4. APPOINTMENTS + SCHEDULES HYDRATION
  console.log(`\n⏳ Baixando milhares de Appointments e Schedules...`)
  const appointments = await fetchAll(supabase, 'appointments')
  const schedules = await fetchAll(supabase, 'schedules', 'id, start_time, end_time')
  
  console.log(`Appointments: ${appointments.length} | Schedules: ${schedules.length}`)
  
  const scheduleMap = new Map()
  for(const s of schedules) scheduleMap.set(s.id, { start_time: s.start_time, end_time: s.end_time })
    
  let ops = 0
  b = db.batch()
  for(const a of appointments) {
    const timeData = a.schedule_id ? scheduleMap.get(a.schedule_id) : null
    const noSqlDoc = { ...a }
    if (timeData) {
      noSqlDoc.schedules = timeData
    }
    b.set(companyRef.collection('appointments').doc(a.id), noSqlDoc)
    
    ops++
    if (ops >= 400) {
      await b.commit()
      b = db.batch()
      ops = 0
    }
  }
  if (ops > 0) await b.commit()
  
  console.log(`\n🎉 Migração Absoluta Finalizada com Sucesso! Bypassados todos limits da API.`)
}

runSync().catch(console.error)

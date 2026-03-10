import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

async function check() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const supabase = createClient(supabaseUrl!, supabaseKey!)

  console.log('--- SUPABASE COUNTS ---')
  
  const tables = ['appointments', 'packages', 'subscription_plans', 'partnerships', 'partnership_discounts', 'schedules', 'client_packages', 'client_subscriptions']
  for (const t of tables) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true })
    console.log(`${t}: ${count}`)
  }
}
check()

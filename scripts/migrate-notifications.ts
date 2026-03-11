import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
// import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const MAIN_COMPANY_ID = 'fpl-saude'

async function runMigration() {
    console.log('🚀 Iniciando Migração de Notificações: Supabase -> Firestore')

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

    console.log('\n⏳ Buscando notificações do Supabase...')
    const { data: notifications, error } = await supabase.from('professional_notifications').select('*')

    if (error) {
        console.error('Erro ao buscar notificações:', error)
        process.exit(1)
    }

    if (notifications && notifications.length > 0) {
        console.log(`Encontradas ${notifications.length} notificações.`)

        // Process in batches
        for (let i = 0; i < notifications.length; i += 500) {
            const batch = db.batch()
            const chunk = notifications.slice(i, i + 500)

            for (const n of chunk) {
                if (!n.professional_id) continue;
                const ref = db
                    .collection('companies')
                    .doc(MAIN_COMPANY_ID)
                    .collection('professionals')
                    .doc(n.professional_id)
                    .collection('notifications')
                    .doc(n.id)

                batch.set(ref, {
                    id: n.id,
                    professional_id: n.professional_id,
                    title: n.title || 'Notificação',
                    content: n.message || n.content || '',
                    is_read: n.is_read || false,
                    link: n.link || null,
                    created_at: n.created_at
                })
            }
            await batch.commit()
            console.log(`Lote exportado (${i + chunk.length} de ${notifications.length})`)
        }
        console.log(`✅ ${notifications.length} Notificações migradas com sucesso.`)
    } else {
        console.log('Nenhuma notificação encontrada no Supabase.')
    }
}

runMigration().catch(console.error)

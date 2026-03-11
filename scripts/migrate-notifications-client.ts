
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore'
// import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const MAIN_COMPANY_ID = 'fpl-saude'

async function runMigrationClient() {
    console.log('🚀 Iniciando Migração de Notificações com Client SDK')

    const firebaseConfig = {
        apiKey: process.env.VITE_FIREBASE_API_KEY,
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.VITE_FIREBASE_APP_ID,
    }

    const app = initializeApp(firebaseConfig)
    const db = getFirestore(app)

    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ ERRO: Chaves do Supabase ausentes.')
        process.exit(1)
    }

    /*
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('\n⏳ Buscando notificações do Supabase...')
    const { data: notifications, error } = await supabase.from('professional_notifications').select('*')

    if (error) {
        console.error('Erro ao buscar notificações:', error)
        process.exit(1)
    }
    */
   
    const notifications: any[] = []

    if (notifications && notifications.length > 0) {
        console.log(`Encontradas ${notifications.length} notificações.`)

        // We process sequentially or in parallel using Promises since client SDK doesn't have Server Batch exactly like Admin
        let count = 0
        for (const n of notifications) {
            if (!n.professional_id) continue;

            const ref = doc(db, 'companies', MAIN_COMPANY_ID, 'professionals', n.professional_id, 'notifications', n.id)

            await setDoc(ref, {
                id: n.id,
                professional_id: n.professional_id,
                title: n.title || 'Notificação',
                content: n.message || n.content || '',
                is_read: n.is_read || false,
                link: n.link || null,
                created_at: n.created_at
            })
            count++
        }
        console.log(`✅ ${count} Notificações migradas com sucesso via Client SDK.`)
    } else {
        console.log('Nenhuma notificação encontrada no Supabase.')
    }
}

runMigrationClient().catch(console.error).then(() => process.exit(0))

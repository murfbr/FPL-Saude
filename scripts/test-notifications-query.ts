import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const MAIN_COMPANY_ID = 'fpl-saude'

async function testQuery() {
    console.log('🔍 Testando consulta de Notificações no Firestore Admin...')

    const serviceAccountPath = './firebase-service-account.json'
    if (!fs.existsSync(serviceAccountPath)) {
        console.error('❌ ERRO: firebase-service-account.json não encontrado.')
        process.exit(1)
    }
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
    initializeApp({ credential: cert(serviceAccount) })
    const db = getFirestore()

    // Buscar todos os profissionais para obter o ID do primeiro
    const professionalsSnapshot = await db.collection('companies').doc(MAIN_COMPANY_ID).collection('professionals').limit(1).get()

    if (professionalsSnapshot.empty) {
        console.log('Nenhum profissional encontrado na companhia master.')
        return
    }

    const pro = professionalsSnapshot.docs[0]
    const proId = pro.id

    console.log(`Testando para o profisssional: ${pro.data().name} (${proId})`)

    const notificationsRef = db.collection('companies').doc(MAIN_COMPANY_ID).collection('professionals').doc(proId).collection('notifications')

    // 1. Contagem total
    const countSnap = await notificationsRef.count().get()
    console.log(`\nTotal de notificações (Query Count): ${countSnap.data().count}`)

    // 2. Fetch com "where" normal
    const unreadSnap = await notificationsRef.where('is_read', '==', false).get()
    console.log(`\nTotal não lidas (Query by is_read==false): ${unreadSnap.size}`)

    if (!unreadSnap.empty) {
        console.log('Primeira notificação não lida (Amostra):')
        console.log(unreadSnap.docs[0].data())
    }

    // 3. Fetch genérico
    const allSnap = await notificationsRef.get()
    console.log(`\nFetch getAll (Tamanho): ${allSnap.size}`)
}

testQuery().catch(console.error)

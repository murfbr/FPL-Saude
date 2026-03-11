import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const MAIN_COMPANY_ID = 'fpl-saude'

async function addMockNotification() {
    console.log('🔔 Adicionando Notificação de Teste...')

    const serviceAccountPath = './firebase-service-account.json'
    if (!fs.existsSync(serviceAccountPath)) {
        console.error('❌ ERRO: firebase-service-account.json não encontrado.')
        process.exit(1)
    }
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
    initializeApp({ credential: cert(serviceAccount) })
    const db = getFirestore()

    const professionalsSnapshot = await db.collection('companies').doc(MAIN_COMPANY_ID).collection('professionals').limit(1).get()

    if (professionalsSnapshot.empty) {
        console.log('Nenhum profissional encontrado para receber a notificação.')
        return
    }

    const pro = professionalsSnapshot.docs[0]
    const proId = pro.id

    console.log(`Enviando notificação para o profisssional: ${pro.data().name} (${proId})`)

    const notificationsRef = db.collection('companies').doc(MAIN_COMPANY_ID).collection('professionals').doc(proId).collection('notifications')

    await notificationsRef.add({
        professional_id: proId,
        title: 'Bem vindo ao Firebase!',
        content: 'A sua migração de notificações para o Firestore foi concluída com sucesso. Essa é uma mensagem de teste.',
        is_read: false,
        link: '/profissional/dashboard',
        created_at: new Date().toISOString()
    });

    console.log('✅ Notificação de teste inserida!')
}

addMockNotification().catch(console.error)

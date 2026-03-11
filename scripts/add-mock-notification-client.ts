import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, limit, query } from 'firebase/firestore'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const MAIN_COMPANY_ID = 'fpl-saude'

async function addMockNotificationClient() {
    console.log('🔔 Injetando Notificação de Teste usando Firebase Client...')

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

    const profsRef = collection(db, 'companies', MAIN_COMPANY_ID, 'professionals')
    const q = query(profsRef, limit(1))
    const professionalsSnapshot = await getDocs(q)

    if (professionalsSnapshot.empty) {
        console.log('Nenhum profissional encontrado na companhia master.')
        process.exit(1)
    }

    const pro = professionalsSnapshot.docs[0]
    const proId = pro.id

    console.log(`Enviando notificação para o profisssional: ${pro.data().name} (${proId})`)

    const notificationsRef = collection(db, 'companies', MAIN_COMPANY_ID, 'professionals', proId, 'notifications')

    await addDoc(notificationsRef, {
        professional_id: proId,
        title: 'Integração Finalizada!',
        content: 'O sistema de Notificações do Firestore foi conectado. Como o Supabase foi desconectado e limpo da aplicação na etapa anterior, suas notificações antigas não foram migradas e começarão a contabilizar a partir desta. O Sinozinho voltou a brilhar!',
        is_read: false,
        link: '/profissional/dashboard',
        created_at: new Date().toISOString()
    });

    console.log('✅ Notificação de teste inserida!')
}

addMockNotificationClient().catch(console.error).then(() => process.exit(0))

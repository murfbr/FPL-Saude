import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const MAIN_COMPANY_ID = 'fpl-saude'

async function restrutureFirebaseClient() {
    console.log('🚀 Iniciando Fase 3: Reestruturação Hieraquica do Firestore (Client SDK)')

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

    // Ref para a empresa padrão
    const compPath = `companies/${MAIN_COMPANY_ID}`

    console.log('\n--- 📦 Remodelando Pacotes de Clientes (client_packages) ---')
    const clientPackagesRef = collection(db, `${compPath}/client_packages`)
    const packagesSnap = await getDocs(clientPackagesRef)

    if (packagesSnap.empty) {
        console.log('Nenhum pacote solto encontrado na raiz.')
    } else {
        console.log(`Encontrados ${packagesSnap.size} pacotes soltos. Movendo para as subcoleções cliente...`)
        let countPkgs = 0

        // Processamento sequencial simples
        for (const d of packagesSnap.docs) {
            const data = d.data()
            if (data.client_id) {
                // companies/{comp}/clients/{clientId}/packages/{docId}
                const newRef = doc(db, `${compPath}/clients/${data.client_id}/packages/${d.id}`)
                await setDoc(newRef, data)
                await deleteDoc(d.ref)
                countPkgs++
            }
        }
        console.log(`✅ ${countPkgs} pacotes engavetados e limpos da raiz.`)
    }

    console.log('\n--- 💳 Remodelando Assinaturas de Clientes (client_subscriptions) ---')
    const clientSubsRef = collection(db, `${compPath}/client_subscriptions`)
    const subsSnap = await getDocs(clientSubsRef)

    if (subsSnap.empty) {
        console.log('Nenhuma assinatura solta encontrada na raiz.')
    } else {
        console.log(`Encontradas ${subsSnap.size} assinaturas soltas. Movendo para as subcoleções do cliente...`)
        let countSubs = 0

        for (const d of subsSnap.docs) {
            const data = d.data()
            if (data.client_id) {
                const newRef = doc(db, `${compPath}/clients/${data.client_id}/subscriptions/${d.id}`)
                await setDoc(newRef, data)
                await deleteDoc(d.ref)
                countSubs++
            }
        }
        console.log(`✅ ${countSubs} assinaturas devidamente aninhadas.`)
    }

    console.log('\n🎉 Reestruturação NoSQL concluída com sucesso via Client API!')
}

restrutureFirebaseClient().catch(console.error).then(() => process.exit(0))

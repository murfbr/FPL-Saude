import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const MAIN_COMPANY_ID = 'fpl-saude'

async function restrutureFirebase() {
    console.log('🚀 Iniciando Fase 3: Reestruturação Hieraquica do Firestore (NoSQL)')

    const serviceAccountPath = './firebase-service-account.json'
    if (!fs.existsSync(serviceAccountPath)) {
        console.error('❌ ERRO: firebase-service-account.json não encontrado.')
        process.exit(1)
    }
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
    initializeApp({ credential: cert(serviceAccount) })
    const db = getFirestore()
    const companyRef = db.collection('companies').doc(MAIN_COMPANY_ID)

    console.log('\n--- 📦 Remodelando Pacotes de Clientes (client_packages) ---')
    const clientPackagesRef = companyRef.collection('client_packages')
    const packagesSnap = await clientPackagesRef.get()

    if (packagesSnap.empty) {
        console.log('Nenhum pacote solto encontrado na raiz.')
    } else {
        console.log(`Encontrados ${packagesSnap.size} pacotes soltos. Movendo para os clientes...`)
        const batch = db.batch()
        let count = 0
        let deletions = 0

        for (const doc of packagesSnap.docs) {
            const data = doc.data()
            if (data.client_id) {
                // Create new location path: companies/X/clients/Y/packages/Z
                const newRef = companyRef.collection('clients').doc(data.client_id).collection('packages').doc(doc.id)
                batch.set(newRef, data)
                count++

                // Prepare to delete the old document
                batch.delete(doc.ref)
                deletions++
            }
        }

        if (count > 0) {
            await batch.commit()
            console.log(`✅ ${count} pacotes movidos com sucesso e deletados da raiz.`)
        }
    }

    console.log('\n--- 💳 Remodelando Assinaturas de Clientes (client_subscriptions) ---')
    const clientSubsRef = companyRef.collection('client_subscriptions')
    const subsSnap = await clientSubsRef.get()

    if (subsSnap.empty) {
        console.log('Nenhuma assinatura solta encontrada na raiz.')
    } else {
        console.log(`Encontradas ${subsSnap.size} assinaturas soltas. Movendo para os clientes...`)
        let count = 0
        // Batch limit is 500 operations. Doing it manually for simplicity if size is small.
        // If large, chunk arrays into 250 (1 write + 1 delete per item)
        const chunks = []
        let currentChunk = []

        for (const doc of subsSnap.docs) {
            const data = doc.data()
            if (data.client_id) {
                currentChunk.push(doc)
                if (currentChunk.length >= 250) {
                    chunks.push([...currentChunk])
                    currentChunk = []
                }
            }
        }
        if (currentChunk.length > 0) chunks.push(currentChunk)

        for (const chunk of chunks) {
            const batch = db.batch()
            for (const doc of chunk) {
                const data = doc.data()
                const newRef = companyRef.collection('clients').doc(data.client_id).collection('subscriptions').doc(doc.id)
                batch.set(newRef, data)
                batch.delete(doc.ref)
                count++
            }
            await batch.commit()
        }
        console.log(`✅ ${count} assinaturas movidas com sucesso e deletadas da raiz.`)
    }

    console.log('\n🎉 Reestruturação NoSQL concluída!')
}

restrutureFirebase().catch(console.error).then(() => process.exit(0))

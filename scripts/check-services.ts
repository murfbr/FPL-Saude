import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const projectId = process.env.VITE_FIREBASE_PROJECT_ID
initializeApp({ projectId })
const db = getFirestore()

async function main() {
  const snap = await db.collection('companies').doc('fpl-saude').collection('services').get()
  
  if (snap.empty) {
    console.log('No services found.')
    process.exit(0)
  }

  snap.forEach(doc => {
    const data = doc.data()
    console.log(`Service: ${data.name} | ReqObs: ${data.requires_observation} | ID: ${doc.id}`)
  })
  process.exit(0)
}

main()

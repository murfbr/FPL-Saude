import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const projectId = process.env.VITE_FIREBASE_PROJECT_ID
initializeApp({ projectId })
const db = getFirestore()

async function main() {
  const snap = await db.collection('companies').doc('fpl-saude').collection('appointments').where('status', '==', 'completed').limit(20).get()
  
  if (snap.empty) {
    console.log('No completed appointments found.')
    process.exit(0)
  }

  snap.forEach(doc => {
    const data = doc.data()
    console.log(`${doc.id} | Status: ${data.status} | ReqObs: ${data.services?.requires_observation} | NotesLen: ${data.notes?.length || 0}`)
  })
  process.exit(0)
}

main()

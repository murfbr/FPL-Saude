import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as fs from 'fs'

async function check() {
  const serviceAccount = JSON.parse(fs.readFileSync('./firebase-service-account.json', 'utf8'))
  if (!getFirestore) return
  initializeApp({ credential: cert(serviceAccount) })
  const db = getFirestore()

  const srvs = await db.collection('companies/fpl-saude/services').get()
  srvs.docs.forEach(d => {
     console.log('SRV:', d.data().name, 'Has Packages?', !!d.data().packages)
  })
}
check()

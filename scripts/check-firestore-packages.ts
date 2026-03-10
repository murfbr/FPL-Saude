import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as fs from 'fs'

async function check() {
  const serviceAccount = JSON.parse(fs.readFileSync('./firebase-service-account.json', 'utf8'))
  if (!getFirestore) return
  initializeApp({ credential: cert(serviceAccount) })
  const db = getFirestore()

  const pkgs = await db.collection('companies/fpl-saude/packages').get()
  pkgs.docs.forEach(d => {
     console.log('PKG:', d.id, d.data().name, '- Active:', d.data().is_active, '- SrvID:', d.data().service_id)
  })

  const plans = await db.collection('companies/fpl-saude/subscription_plans').get()
  plans.docs.forEach(d => {
     console.log('PLAN:', d.id, d.data().name, '- Active:', d.data().is_active, '- SrvID:', d.data().service_id)
  })
}
check()

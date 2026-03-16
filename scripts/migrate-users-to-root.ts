/**
 * Migration: Move users from companies/{companyId}/users/{uid}
 * to the root-level users/{uid} collection.
 *
 * This is required for Phase 1 of the multi-tenant transformation.
 * After this migration, AuthProvider reads from root users/{uid}
 * to resolve the user's companyId on login.
 *
 * Usage:
 *   npx ts-node --project tsconfig.node.json scripts/migrate-users-to-root.ts
 *
 * Set DRY_RUN=true to preview changes without writing.
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const DRY_RUN = process.env.DRY_RUN !== 'false'

// Load service account key
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json'
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ Service account key not found at: ${serviceAccountPath}`)
  console.error('Set FIREBASE_SERVICE_ACCOUNT_PATH env var or place the key at ./firebase-service-account.json')
  process.exit(1)
}

initializeApp({ credential: cert(serviceAccountPath) })
const db = getFirestore()

// List all company IDs to migrate users from.
// Add more company IDs here if needed in the future.
const COMPANY_IDS = ['fpl-saude']

async function run() {
  console.log(`\n🚀 Migrating users to root collection`)
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '✍️  LIVE (writing to Firestore)'}`)
  console.log(`   Companies: ${COMPANY_IDS.join(', ')}\n`)

  let totalMigrated = 0
  let totalSkipped = 0

  for (const companyId of COMPANY_IDS) {
    console.log(`\n📦 Processing company: ${companyId}`)

    const usersSnap = await db.collection('companies').doc(companyId).collection('users').get()
    console.log(`   Found ${usersSnap.size} user(s)`)

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id
      const existingData = userDoc.data()

      // Check if root user doc already exists
      const rootRef = db.collection('users').doc(uid)
      const rootSnap = await rootRef.get()

      if (rootSnap.exists) {
        console.log(`   ⏭️  Skipping ${uid} — root doc already exists`)
        totalSkipped++
        continue
      }

      const newDoc = {
        ...existingData,
        companyId,
      }

      console.log(`   ✅ Migrating ${uid} (${existingData.email ?? 'no email'}) → role: ${existingData.role}`)

      if (!DRY_RUN) {
        await rootRef.set(newDoc)
      }
      totalMigrated++
    }
  }

  console.log(`\n📊 Summary`)
  console.log(`   Migrated : ${totalMigrated}`)
  console.log(`   Skipped  : ${totalSkipped}`)

  if (DRY_RUN) {
    console.log(`\n⚠️  DRY RUN — no data was written.`)
    console.log(`   Re-run with DRY_RUN=false to apply changes:`)
    console.log(`   DRY_RUN=false npx ts-node --project tsconfig.node.json scripts/migrate-users-to-root.ts\n`)
  } else {
    console.log(`\n✅ Migration complete. Users are now readable at root users/{uid}.\n`)
  }
}

run().catch((err) => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})

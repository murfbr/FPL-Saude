/**
 * Semeia os índices planos de assinaturas e pacotes dos pacientes:
 *   companies/{id}/subscriptions_index/{subId}
 *   companies/{id}/client_packages_index/{pkgId}
 *
 * Depois da semeadura, quem mantém os índices é a Cloud Function
 * onEntitlementWrite — rode este script UMA vez, APÓS o deploy dela
 * (escritas entre a semeadura e o deploy ficariam fora do índice).
 *
 * Uso:
 *   npx tsx scripts/seed-entitlement-indexes.ts            # dry-run (só imprime)
 *   npx tsx scripts/seed-entitlement-indexes.ts --write    # grava de verdade
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const projectId = process.env.VITE_FIREBASE_PROJECT_ID
if (!projectId) {
  console.error('❌ VITE_FIREBASE_PROJECT_ID não encontrado no .env.local')
  process.exit(1)
}

const WRITE = process.argv.includes('--write')

initializeApp({ projectId })
const db = getFirestore()

async function main() {
  console.log(
    `\n🔥 Seed dos índices de assinaturas/pacotes — Projeto: ${projectId}${WRITE ? '' : ' — DRY-RUN (use --write para gravar)'}\n`,
  )

  const companiesSnap = await db.collection('companies').listDocuments()

  for (const companyRef of companiesSnap) {
    const clientsSnap = await companyRef.collection('clients').get()
    let subCount = 0
    let pkgCount = 0

    for (const clientDoc of clientsSnap.docs) {
      const clientFields = {
        client_id: clientDoc.id,
        client_name: (clientDoc.data().name as string) || '',
        client_email: (clientDoc.data().email as string) || '',
      }

      const [subsSnap, pkgsSnap] = await Promise.all([
        clientDoc.ref.collection('subscriptions').get(),
        clientDoc.ref.collection('packages').get(),
      ])

      for (const subDoc of subsSnap.docs) {
        const s = subDoc.data()
        subCount++
        if (!WRITE) continue
        await companyRef
          .collection('subscriptions_index')
          .doc(subDoc.id)
          .set({
            id: subDoc.id,
            ...clientFields,
            service_id: s.service_id || null,
            subscription_plan_id: s.subscription_plan_id || null,
            start_date: s.start_date || null,
            end_date: s.end_date || null,
            cancelled_at: s.cancelled_at || null,
            status: s.status || null,
            amount: s.amount ?? null,
            discount_amount: s.discount_amount ?? null,
            created_at: s.created_at || null,
            indexed_at: FieldValue.serverTimestamp(),
          })
      }

      for (const pkgDoc of pkgsSnap.docs) {
        const p = pkgDoc.data()
        pkgCount++
        if (!WRITE) continue
        await companyRef
          .collection('client_packages_index')
          .doc(pkgDoc.id)
          .set({
            id: pkgDoc.id,
            ...clientFields,
            package_id: p.package_id || null,
            purchase_date: p.purchase_date || null,
            sessions_remaining: p.sessions_remaining ?? 0,
            discount_amount: p.discount_amount ?? null,
            status: p.status || null,
            indexed_at: FieldValue.serverTimestamp(),
          })
      }
    }

    console.log(
      `🏢 ${companyRef.id}: ${clientsSnap.size} pacientes → ${subCount} assinaturas, ${pkgCount} pacotes ${WRITE ? 'indexados' : '(dry-run)'}`,
    )
  }

  console.log('\n🏁 Seed concluído.\n')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Erro no seed:', err)
    process.exit(1)
  })

/**
 * Backfill de public_branding/{slug}
 *
 * Espelha o branding público (nome, logo, cores) de cada empresa para a coleção
 * public_branding, usada pela tela de login white-label antes da autenticação.
 * Idempotente — pode rodar quantas vezes precisar.
 *
 * Uso:
 *   npx tsx scripts/backfill-public-branding.ts
 *
 * Pré-requisitos:
 *   - Application Default Credentials (gcloud) e VITE_FIREBASE_PROJECT_ID no .env.local
 */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const projectId = process.env.VITE_FIREBASE_PROJECT_ID
if (!projectId) {
  console.error('❌ VITE_FIREBASE_PROJECT_ID não encontrado no .env.local')
  process.exit(1)
}

initializeApp({ projectId })
const db = getFirestore()

async function main() {
  const companiesSnap = await db.collection('companies').get()
  console.log(`Empresas encontradas: ${companiesSnap.size}`)

  for (const companyDoc of companiesSnap.docs) {
    const data = companyDoc.data()
    const slug = data.slug || companyDoc.id

    await db.collection('public_branding').doc(slug).set({
      company_id: companyDoc.id,
      slug,
      name: data.name || '',
      is_active: data.is_active !== false,
      branding: data.branding || null,
      updated_at: new Date().toISOString(),
    })
    console.log(`✓ public_branding/${slug} (${data.name || companyDoc.id})`)
  }

  console.log('Concluído.')
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('ERRO:', e)
  process.exit(1)
})

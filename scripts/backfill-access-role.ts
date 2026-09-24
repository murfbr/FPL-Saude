/**
 * Backfill do espelho access_role nos cadastros de profissionais.
 *
 * A gestão de profissionais exibe o nível de acesso a partir de
 * companies/{id}/professionals/{pid}.access_role (o admin não lê a coleção
 * raiz users). Cadastros criados antes da Fase 2 não têm o campo — este
 * script copia users/{uid}.role para o espelho de cada profissional com
 * conta vinculada, em todas as empresas.
 *
 * Uso:
 *   npx tsx scripts/backfill-access-role.ts            # dry-run (só imprime)
 *   npx tsx scripts/backfill-access-role.ts --write    # grava de verdade
 *
 * Pré-requisitos:
 *   - GOOGLE_APPLICATION_CREDENTIALS apontando para uma service account JSON, OU
 *   - Variáveis VITE_FIREBASE_PROJECT_ID no .env.local + ADC
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

const WRITE = process.argv.includes('--write')

initializeApp({ projectId })
const db = getFirestore()

async function main() {
  console.log(`Projeto: ${projectId} — modo: ${WRITE ? 'WRITE' : 'dry-run'}\n`)

  const companies = await db.collection('companies').get()
  let updated = 0
  let skipped = 0

  for (const company of companies.docs) {
    const professionals = await company.ref.collection('professionals').get()

    for (const prof of professionals.docs) {
      const data = prof.data()
      const userId = data.user_id as string | undefined

      if (!userId) {
        skipped++
        continue
      }

      const userSnap = await db.collection('users').doc(userId).get()
      const role = userSnap.data()?.role as string | undefined

      if (!role || role === data.access_role) {
        skipped++
        continue
      }

      console.log(
        `[${company.id}] ${data.name || prof.id}: access_role ${data.access_role ?? '(vazio)'} → ${role}`,
      )
      if (WRITE) {
        await prof.ref.set({ access_role: role }, { merge: true })
      }
      updated++
    }
  }

  console.log(
    `\n${WRITE ? 'Atualizados' : 'A atualizar'}: ${updated} — sem mudança/sem conta: ${skipped}`,
  )
  if (!WRITE && updated > 0) {
    console.log('Rode novamente com --write para gravar.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

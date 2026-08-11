/**
 * Backfill da desnormalização de appointments (clients / professionals / services)
 *
 * Appointments criados antes da desnormalização no write não têm os objetos
 * `clients`, `professionals` e `services` embutidos — o hydrateAppointment do
 * frontend faz até 3 getDoc extras por documento A CADA fetch de agenda, o que
 * multiplica os reads do Firestore. Este script mede e corrige.
 *
 * Uso:
 *   npx tsx scripts/backfill-appointment-denormalization.ts                    # dry-run: só mede
 *   npx tsx scripts/backfill-appointment-denormalization.ts --apply            # grava
 *   npx tsx scripts/backfill-appointment-denormalization.ts --company=castanha # limita a um tenant
 *
 * ⚠️ IMPORTANTE: após rodar com --apply, rode também:
 *   npx tsx scripts/backfill-monthly-summaries.ts
 * Motivo: o trigger onAppointmentWrite recalcula os breakdowns de receita quando
 * `services.price` passa a existir num doc `completed` (antes lia 0), inflando
 * by_professional/by_service.revenue nos meses históricos. O backfill de
 * summaries sobrescreve tudo com a verdade e corrige.
 *
 * Pré-requisitos: Application Default Credentials (gcloud) + VITE_FIREBASE_PROJECT_ID
 * no .env.local (mesmo esquema dos demais scripts).
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { DocumentData, DocumentReference } from 'firebase-admin/firestore'
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
// Serviços antigos podem não ter todos os campos (ex.: max_attendees) — não
// queremos que um undefined derrube o write inteiro
db.settings({ ignoreUndefinedProperties: true })

const APPLY = process.argv.includes('--apply')
const companyArg = process.argv
  .find((a) => a.startsWith('--company='))
  ?.split('=')[1]

type Needs = { client?: string; professional?: string; service?: string }
type LegacyDoc = { id: string; needs: Needs; startTime?: string; status?: string }

/** Busca docs referenciados em lotes, 1 read por id único (cache por empresa) */
async function resolveRefs(
  refs: DocumentReference[],
): Promise<Map<string, DocumentData | null>> {
  const cache = new Map<string, DocumentData | null>()
  const CHUNK = 300
  for (let i = 0; i < refs.length; i += CHUNK) {
    const chunk = refs.slice(i, i + CHUNK)
    const snaps = await db.getAll(...chunk)
    snaps.forEach((snap) => {
      cache.set(snap.ref.path, snap.exists ? snap.data()! : null)
    })
  }
  return cache
}

async function processCompany(companyId: string) {
  const companyRef = db.collection('companies').doc(companyId)
  const apptsRef = companyRef.collection('appointments')

  // select() reduz banda; a cobrança de reads é por doc de qualquer forma (one-off)
  const snap = await apptsRef
    .select(
      'client_id',
      'professional_id',
      'service_id',
      'clients',
      'professionals',
      'services',
      'status',
      'schedules.start_time',
    )
    .get()

  let total = 0
  let alreadyOk = 0
  let extraReadsPerFetch = 0
  const legacy: LegacyDoc[] = []
  const byYear: Record<string, number> = {}
  const affectedMonths = new Set<string>()

  snap.forEach((d) => {
    total++
    const data = d.data()
    // Espelha exatamente as condições de fallback do hydrateAppointment:
    // só custa read quando há o id e NÃO há o objeto desnormalizado
    const needs: Needs = {}
    if (data.client_id && !data.clients) needs.client = data.client_id
    if (data.professional_id && !data.professionals) needs.professional = data.professional_id
    if (data.service_id && !data.services) needs.service = data.service_id

    const missingCount = Object.keys(needs).length
    if (missingCount === 0) {
      alreadyOk++
      return
    }

    extraReadsPerFetch += missingCount
    const startTime = data.schedules?.start_time as string | undefined
    legacy.push({ id: d.id, needs, startTime, status: data.status })

    const year = startTime ? startTime.slice(0, 4) : 'sem-data'
    byYear[year] = (byYear[year] || 0) + 1

    // Docs completed que ganharão services.price disparam delta de receita no
    // trigger — esses meses precisam de reconciliação depois
    if (data.status === 'completed' && needs.service && startTime) {
      affectedMonths.add(startTime.slice(0, 7))
    }
  })

  console.log(`\n🏢 ${companyId}`)
  console.log(`   Total de appointments:      ${total}`)
  console.log(`   Já desnormalizados:         ${alreadyOk}`)
  console.log(`   Legados (a corrigir):       ${legacy.length}`)
  console.log(`   Reads extras por fetch que os inclua: +${extraReadsPerFetch}`)
  if (legacy.length > 0) {
    const years = Object.entries(byYear)
      .sort()
      .map(([y, n]) => `${y}: ${n}`)
      .join(' | ')
    console.log(`   Por ano (start_time):       ${years}`)
  }

  if (!APPLY || legacy.length === 0) {
    return { legacyCount: legacy.length, updated: 0, affectedMonths }
  }

  // ── Apply: resolver referências únicas e gravar ──────────────────────────
  const uniqueRefs = new Map<string, DocumentReference>()
  for (const item of legacy) {
    if (item.needs.client)
      uniqueRefs.set(`clients/${item.needs.client}`, companyRef.collection('clients').doc(item.needs.client))
    if (item.needs.professional)
      uniqueRefs.set(`professionals/${item.needs.professional}`, companyRef.collection('professionals').doc(item.needs.professional))
    if (item.needs.service)
      uniqueRefs.set(`services/${item.needs.service}`, companyRef.collection('services').doc(item.needs.service))
  }
  const cache = await resolveRefs([...uniqueRefs.values()])
  const lookup = (col: string, id: string) =>
    cache.get(`companies/${companyId}/${col}/${id}`) ?? null

  const writer = db.bulkWriter()
  let updated = 0
  let dangling = 0

  for (const item of legacy) {
    const update: Record<string, unknown> = {}

    if (item.needs.client) {
      const src = lookup('clients', item.needs.client)
      // Referência órfã: grava { id } mesmo assim — a presença do objeto
      // interrompe o loop de re-fetch do hydrateAppointment
      if (!src) dangling++
      update.clients = src
        ? { id: item.needs.client, name: src.name, email: src.email, phone: src.phone }
        : { id: item.needs.client }
    }

    if (item.needs.professional) {
      const src = lookup('professionals', item.needs.professional)
      if (!src) dangling++
      update.professionals = src
        ? { id: item.needs.professional, name: src.name }
        : { id: item.needs.professional }
    }

    if (item.needs.service) {
      const src = lookup('services', item.needs.service)
      if (!src) dangling++
      // Superset dos shapes de bookAppointment e hydrateAppointment
      update.services = src
        ? {
            id: item.needs.service,
            name: src.name,
            duration_minutes: src.duration_minutes,
            max_attendees: src.max_attendees,
            price: src.price,
            value_type: src.value_type,
            requires_observation: src.requires_observation !== false,
          }
        : { id: item.needs.service }
    }

    writer.update(apptsRef.doc(item.id), update)
    updated++
  }

  await writer.close()
  console.log(`   ✅ ${updated} docs atualizados (${dangling} referências órfãs preenchidas só com { id })`)

  return { legacyCount: legacy.length, updated, affectedMonths }
}

async function main() {
  const companies = companyArg
    ? [companyArg]
    : (await db.collection('companies').listDocuments()).map((r) => r.id)

  console.log(APPLY ? '🔥 Modo APPLY — gravando no Firestore' : '🔍 Modo DRY-RUN — nada será gravado (use --apply para corrigir)')
  console.log(`Empresas: ${companies.join(', ')}`)

  let totalLegacy = 0
  let totalUpdated = 0
  const allAffectedMonths = new Set<string>()

  for (const companyId of companies) {
    const r = await processCompany(companyId)
    totalLegacy += r.legacyCount
    totalUpdated += r.updated
    r.affectedMonths.forEach((m) => allAffectedMonths.add(`${companyId} ${m}`))
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Total de docs legados: ${totalLegacy}${APPLY ? ` | atualizados: ${totalUpdated}` : ''}`)

  if (APPLY && allAffectedMonths.size > 0) {
    console.log(`\n⚠️ ${allAffectedMonths.size} mês(es) tiveram receita de breakdown alterada pelo trigger.`)
    console.log('   Rode agora a reconciliação para corrigir os summaries:')
    console.log('   npx tsx scripts/backfill-monthly-summaries.ts')
  }

  console.log('\n✔️ Concluído.')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Erro fatal:', e)
    process.exit(1)
  })

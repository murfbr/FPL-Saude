import { format } from 'date-fns'
import { db, Inc, ServerTs } from '../config'
import type { firestore } from 'firebase-admin'

export function monthKeyOf(isoDate: string): string | null {
  const d = new Date(isoDate)
  return isNaN(d.getTime()) ? null : format(d, 'yyyy-MM')
}

export function summaryRef(companyId: string, monthKey: string) {
  return db
    .collection('companies')
    .doc(companyId)
    .collection('monthly_summaries')
    .doc(monthKey)
}

export const STATUS_FIELDS: Record<string, string> = {
  completed: 'completed_appointments',
  cancelled: 'cancelled_appointments',
  no_show: 'no_show_appointments',
}

export function appointmentDelta(
  before: firestore.DocumentData | undefined,
  after: firestore.DocumentData | undefined,
): Record<string, any> | null {
  const updates: Record<string, any> = {
    updated_at: ServerTs(),
  }

  // ── Contagem total de agendamentos ────────────────────────────────────
  if (after && !before) updates.total_appointments = Inc(1) // criação
  if (before && !after) updates.total_appointments = Inc(-1) // deleção

  // ── Contadores por status ─────────────────────────────────────────────
  const bStatus = before?.status as string | undefined
  const aStatus = after?.status as string | undefined

  // Acumula deltas por campo para evitar dupla atribuição no mesmo key
  const statusDeltas: Record<string, number> = {}
  if (bStatus && STATUS_FIELDS[bStatus]) {
    statusDeltas[STATUS_FIELDS[bStatus]] = -1
  }
  if (aStatus && STATUS_FIELDS[aStatus]) {
    const field = STATUS_FIELDS[aStatus]
    statusDeltas[field] = (statusDeltas[field] || 0) + 1
  }
  for (const [field, delta] of Object.entries(statusDeltas)) {
    if (delta !== 0) updates[field] = Inc(delta)
  }

  // ── Breakdowns (by_professional, by_service, by_partnership) ──────────
  // Breakdowns contam apenas appointments COMPLETED.
  const wasCompleted = bStatus === 'completed'
  const isCompleted = aStatus === 'completed'

  if (wasCompleted || isCompleted) {
    // Acumula deltas numéricos por ID antes de converter em FieldValue
    const profAcc: Record<
      string,
      { name: string; completed: number; revenue: number }
    > = {}
    const svcAcc: Record<
      string,
      { name: string; count: number; revenue: number }
    > = {}
    const partAcc: Record<string, { sessionCount: number }> = {}

    // Subtrair breakdown do estado anterior (se era completed)
    if (wasCompleted && before) {
      const pId = before.professional_id as string
      const sId = before.service_id as string
      const price = (before.services?.price as number) || 0
      const partnId = before.partnership_id as string | null

      if (pId) {
        profAcc[pId] = profAcc[pId] || {
          name: (before.professionals?.name as string) || '',
          completed: 0,
          revenue: 0,
        }
        profAcc[pId].completed -= 1
        profAcc[pId].revenue -= price
      }
      if (sId) {
        svcAcc[sId] = svcAcc[sId] || {
          name: (before.services?.name as string) || '',
          count: 0,
          revenue: 0,
        }
        svcAcc[sId].count -= 1
        svcAcc[sId].revenue -= price
      }
      if (partnId) {
        partAcc[partnId] = partAcc[partnId] || { sessionCount: 0 }
        partAcc[partnId].sessionCount -= 1
      }
    }

    // Adicionar breakdown do estado atual (se é completed)
    if (isCompleted && after) {
      const pId = after.professional_id as string
      const sId = after.service_id as string
      const price = (after.services?.price as number) || 0
      const partnId = after.partnership_id as string | null

      if (pId) {
        profAcc[pId] = profAcc[pId] || {
          name: (after.professionals?.name as string) || '',
          completed: 0,
          revenue: 0,
        }
        // Prioriza o nome mais recente
        profAcc[pId].name =
          (after.professionals?.name as string) || profAcc[pId].name
        profAcc[pId].completed += 1
        profAcc[pId].revenue += price
      }
      if (sId) {
        svcAcc[sId] = svcAcc[sId] || {
          name: (after.services?.name as string) || '',
          count: 0,
          revenue: 0,
        }
        svcAcc[sId].name =
          (after.services?.name as string) || svcAcc[sId].name
        svcAcc[sId].count += 1
        svcAcc[sId].revenue += price
      }
      if (partnId) {
        partAcc[partnId] = partAcc[partnId] || { sessionCount: 0 }
        partAcc[partnId].sessionCount += 1
      }
    }

    // Converter acumuladores em FieldValue.increment para o Firestore
    const profObj: Record<string, any> = {}
    for (const [id, d] of Object.entries(profAcc)) {
      if (d.completed !== 0 || d.revenue !== 0) {
        profObj[id] = { name: d.name }
        if (d.completed !== 0) profObj[id].completed = Inc(d.completed)
        if (d.revenue !== 0) profObj[id].revenue = Inc(d.revenue)
      }
    }
    if (Object.keys(profObj).length > 0) updates.by_professional = profObj

    const svcObj: Record<string, any> = {}
    for (const [id, d] of Object.entries(svcAcc)) {
      if (d.count !== 0 || d.revenue !== 0) {
        svcObj[id] = { name: d.name }
        if (d.count !== 0) svcObj[id].count = Inc(d.count)
        if (d.revenue !== 0) svcObj[id].revenue = Inc(d.revenue)
      }
    }
    if (Object.keys(svcObj).length > 0) updates.by_service = svcObj

    const partObj: Record<string, any> = {}
    for (const [id, d] of Object.entries(partAcc)) {
      if (d.sessionCount !== 0) {
        partObj[id] = { sessionCount: Inc(d.sessionCount) }
      }
    }
    if (Object.keys(partObj).length > 0) updates.by_partnership = partObj
  }

  // Se o único campo é updated_at, não há mudança real → skip write
  const hasReal = Object.keys(updates).some((k) => k !== 'updated_at')
  return hasReal ? updates : null
}

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

  // ── Breakdowns (by_professional, by_service, by_partnership e matrizes cruzadas)
  const isTrackedStatus = (s?: string) => s === 'completed' || s === 'cancelled' || s === 'no_show'
  const wasTracked = isTrackedStatus(bStatus)
  const isTracked = isTrackedStatus(aStatus)

  if (wasTracked || isTracked) {
    const profAcc: Record<string, any> = {}
    const svcAcc: Record<string, any> = {}
    const partAcc: Record<string, any> = {}
    const profSvcAcc: Record<string, any> = {}
    const profPartAcc: Record<string, any> = {}

    const applyStats = (docData: firestore.DocumentData, status: string, multiplier: number) => {
      const pId = docData.professional_id as string
      const sId = docData.service_id as string
      const price = (docData.services?.price as number) || 0
      const partnId = docData.partnership_id as string | null

      const isComp = status === 'completed' ? multiplier : 0
      const isCanc = status === 'cancelled' ? multiplier : 0
      const isNoSh = status === 'no_show' ? multiplier : 0
      const revDelta = status === 'completed' ? price * multiplier : 0

      if (pId) {
        profAcc[pId] = profAcc[pId] || { name: (docData.professionals?.name as string) || '', completed: 0, cancelled: 0, no_show: 0, revenue: 0 }
        if (multiplier > 0) profAcc[pId].name = (docData.professionals?.name as string) || profAcc[pId].name
        profAcc[pId].completed += isComp
        profAcc[pId].cancelled += isCanc
        profAcc[pId].no_show += isNoSh
        profAcc[pId].revenue += revDelta

        if (sId) {
          const crossId = `${pId}_${sId}`
          profSvcAcc[crossId] = profSvcAcc[crossId] || { completed: 0, cancelled: 0, no_show: 0, revenue: 0 }
          profSvcAcc[crossId].completed += isComp
          profSvcAcc[crossId].cancelled += isCanc
          profSvcAcc[crossId].no_show += isNoSh
          profSvcAcc[crossId].revenue += revDelta
        }

        if (partnId) {
          const crossId = `${pId}_${partnId}`
          profPartAcc[crossId] = profPartAcc[crossId] || { completed: 0, cancelled: 0, no_show: 0, revenue: 0 }
          profPartAcc[crossId].completed += isComp
          profPartAcc[crossId].cancelled += isCanc
          profPartAcc[crossId].no_show += isNoSh
          profPartAcc[crossId].revenue += revDelta
        }
      }

      if (sId) {
        svcAcc[sId] = svcAcc[sId] || { name: (docData.services?.name as string) || '', count: 0, cancelled: 0, no_show: 0, revenue: 0 }
        if (multiplier > 0) svcAcc[sId].name = (docData.services?.name as string) || svcAcc[sId].name
        svcAcc[sId].count += isComp
        svcAcc[sId].cancelled += isCanc
        svcAcc[sId].no_show += isNoSh
        svcAcc[sId].revenue += revDelta
      }

      if (partnId) {
        partAcc[partnId] = partAcc[partnId] || { sessionCount: 0, cancelled: 0, no_show: 0, revenue: 0 }
        partAcc[partnId].sessionCount += isComp
        partAcc[partnId].cancelled += isCanc
        partAcc[partnId].no_show += isNoSh
        partAcc[partnId].revenue += revDelta
      }
    }

    if (wasTracked && before) {
      applyStats(before, bStatus!, -1)
    }
    if (isTracked && after) {
      applyStats(after, aStatus!, 1)
    }

    const buildUpdate = (acc: Record<string, any>, nameField: string | null = null, countField: string = 'completed') => {
      const obj: Record<string, any> = {}
      for (const [id, d] of Object.entries(acc)) {
        if (d[countField] !== 0 || d.revenue !== 0 || d.cancelled !== 0 || d.no_show !== 0) {
          obj[id] = {}
          if (nameField && d[nameField]) obj[id][nameField] = d[nameField]
          if (d[countField] !== 0) obj[id][countField] = Inc(d[countField])
          if (d.cancelled !== 0) obj[id].cancelled = Inc(d.cancelled)
          if (d.no_show !== 0) obj[id].no_show = Inc(d.no_show)
          if (d.revenue !== 0) obj[id].revenue = Inc(d.revenue)
        }
      }
      return obj
    }

    const profObj = buildUpdate(profAcc, 'name', 'completed')
    if (Object.keys(profObj).length > 0) updates.by_professional = profObj

    const svcObj = buildUpdate(svcAcc, 'name', 'count')
    if (Object.keys(svcObj).length > 0) updates.by_service = svcObj

    const partObj = buildUpdate(partAcc, null, 'sessionCount')
    if (Object.keys(partObj).length > 0) updates.by_partnership = partObj

    const profSvcObj = buildUpdate(profSvcAcc, null, 'completed')
    if (Object.keys(profSvcObj).length > 0) updates.by_professional_service = profSvcObj

    const profPartObj = buildUpdate(profPartAcc, null, 'completed')
    if (Object.keys(profPartObj).length > 0) updates.by_professional_partnership = profPartObj
  }

  const hasReal = Object.keys(updates).some((k) => k !== 'updated_at')
  return hasReal ? updates : null
}

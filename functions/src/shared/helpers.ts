import { db, Inc, ServerTs } from '../config'
import type { firestore } from 'firebase-admin'
import {
  monthKeyOf as coreMonthKeyOf,
  classifyAppointment,
  effectivePrice,
  AppointmentLike,
} from './summaryCore'

export function monthKeyOf(isoDate: string): string | null {
  return coreMonthKeyOf(isoDate)
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

type StatsAcc = { name?: string; nums: Record<string, number> }

function addNum(acc: StatsAcc, field: string, delta: number) {
  if (delta === 0) return
  acc.nums[field] = (acc.nums[field] || 0) + delta
}

/**
 * Delta incremental do monthly_summary para uma escrita de appointment.
 * A semântica dos campos vem de summaryCore (mesma do cron/backfill):
 * revenue = caixa avulso; production_value = produção de toda concluída.
 * O trigger não escreve clientCount (exige Set — só o recálculo integral)
 * nem independent_revenue de by_professional (mantido por
 * onFinancialRecordWrite a partir dos registros reais).
 */
export function appointmentDelta(
  before: firestore.DocumentData | undefined,
  after: firestore.DocumentData | undefined,
): Record<string, any> | null {
  const updates: Record<string, any> = {
    updated_at: ServerTs(),
  }

  // ── Contagem total de agendamentos ────────────────────────────────────
  if (after && !before) updates.total_appointments = Inc(1)
  if (before && !after) updates.total_appointments = Inc(-1)

  // ── Contadores por status ─────────────────────────────────────────────
  const bStatus = before?.status as string | undefined
  const aStatus = after?.status as string | undefined

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

  // ── Breakdowns ────────────────────────────────────────────────────────
  const isTrackedStatus = (s?: string) =>
    s === 'completed' || s === 'cancelled' || s === 'no_show'
  const wasTracked = isTrackedStatus(bStatus)
  const isTracked = isTrackedStatus(aStatus)

  if (wasTracked || isTracked) {
    let totalProductionDelta = 0

    const profAcc: Record<string, StatsAcc> = {}
    const svcAcc: Record<string, StatsAcc> = {}
    const partAcc: Record<string, StatsAcc> = {}
    const profSvcAcc: Record<string, StatsAcc> = {}
    const profPartAcc: Record<string, StatsAcc> = {}

    const acc = (map: Record<string, StatsAcc>, id: string): StatsAcc => {
      if (!map[id]) map[id] = { nums: {} }
      return map[id]
    }

    const applyStats = (
      docData: firestore.DocumentData,
      status: string,
      multiplier: number,
    ) => {
      const appt = docData as AppointmentLike
      const pId = appt.professional_id
      const sId = appt.service_id
      const partnId = appt.partnership_id

      const billing = classifyAppointment(appt)
      const price = effectivePrice(appt)

      const isComp = status === 'completed' ? multiplier : 0
      const isCanc = status === 'cancelled' ? multiplier : 0
      const isNoSh = status === 'no_show' ? multiplier : 0
      const productionDelta = status === 'completed' ? price * multiplier : 0
      const revenueDelta =
        status === 'completed' && billing === 'independent'
          ? price * multiplier
          : 0
      const sessionField =
        billing === 'package'
          ? 'package_sessions'
          : billing === 'subscription'
            ? 'subscription_sessions'
            : 'independent_sessions'

      totalProductionDelta += productionDelta

      const applyTo = (a: StatsAcc, completedField: string) => {
        addNum(a, completedField, isComp)
        addNum(a, 'cancelled', isCanc)
        addNum(a, 'no_show', isNoSh)
        addNum(a, 'production_value', productionDelta)
        addNum(a, 'revenue', revenueDelta)
        if (isComp !== 0) addNum(a, sessionField, isComp)
      }

      if (pId) {
        const a = acc(profAcc, pId)
        if (multiplier > 0)
          a.name = (appt.professionals?.name as string) || a.name
        applyTo(a, 'completed')

        if (sId) applyTo(acc(profSvcAcc, `${pId}_${sId}`), 'completed')
        if (partnId) applyTo(acc(profPartAcc, `${pId}_${partnId}`), 'completed')
      }

      if (sId) {
        const a = acc(svcAcc, sId)
        if (multiplier > 0) a.name = (appt.services?.name as string) || a.name
        applyTo(a, 'count')
      }

      if (partnId) {
        const a = acc(partAcc, partnId)
        if (multiplier > 0) a.name = appt.partnerships?.name || a.name
        applyTo(a, 'sessionCount')
      }
    }

    if (wasTracked && before) applyStats(before, bStatus!, -1)
    if (isTracked && after) applyStats(after, aStatus!, 1)

    const buildUpdate = (accMap: Record<string, StatsAcc>) => {
      const obj: Record<string, any> = {}
      for (const [id, a] of Object.entries(accMap)) {
        const entry: Record<string, any> = {}
        if (a.name) entry.name = a.name
        for (const [field, delta] of Object.entries(a.nums)) {
          if (delta !== 0) entry[field] = Inc(delta)
        }
        if (Object.keys(entry).length > 0) obj[id] = entry
      }
      return obj
    }

    const profObj = buildUpdate(profAcc)
    if (Object.keys(profObj).length > 0) updates.by_professional = profObj

    const svcObj = buildUpdate(svcAcc)
    if (Object.keys(svcObj).length > 0) updates.by_service = svcObj

    const partObj = buildUpdate(partAcc)
    if (Object.keys(partObj).length > 0) updates.by_partnership = partObj

    const profSvcObj = buildUpdate(profSvcAcc)
    if (Object.keys(profSvcObj).length > 0)
      updates.by_professional_service = profSvcObj

    const profPartObj = buildUpdate(profPartAcc)
    if (Object.keys(profPartObj).length > 0)
      updates.by_professional_partnership = profPartObj

    if (totalProductionDelta !== 0)
      updates.total_production_value = Inc(totalProductionDelta)
  }

  const hasReal = Object.keys(updates).some((k) => k !== 'updated_at')
  return hasReal ? updates : null
}

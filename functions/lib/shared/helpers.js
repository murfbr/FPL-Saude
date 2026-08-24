"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATUS_FIELDS = void 0;
exports.monthKeyOf = monthKeyOf;
exports.summaryRef = summaryRef;
exports.appointmentDelta = appointmentDelta;
const config_1 = require("../config");
const summaryCore_1 = require("./summaryCore");
function monthKeyOf(isoDate) {
    return (0, summaryCore_1.monthKeyOf)(isoDate);
}
function summaryRef(companyId, monthKey) {
    return config_1.db
        .collection('companies')
        .doc(companyId)
        .collection('monthly_summaries')
        .doc(monthKey);
}
exports.STATUS_FIELDS = {
    completed: 'completed_appointments',
    cancelled: 'cancelled_appointments',
    no_show: 'no_show_appointments',
};
function addNum(acc, field, delta) {
    if (delta === 0)
        return;
    acc.nums[field] = (acc.nums[field] || 0) + delta;
}
/**
 * Delta incremental do monthly_summary para uma escrita de appointment.
 * A semântica dos campos vem de summaryCore (mesma do cron/backfill):
 * revenue = caixa avulso; production_value = produção de toda concluída.
 * O trigger não escreve clientCount (exige Set — só o recálculo integral)
 * nem independent_revenue de by_professional (mantido por
 * onFinancialRecordWrite a partir dos registros reais).
 */
function appointmentDelta(before, after) {
    const updates = {
        updated_at: (0, config_1.ServerTs)(),
    };
    // ── Contagem total de agendamentos ────────────────────────────────────
    if (after && !before)
        updates.total_appointments = (0, config_1.Inc)(1);
    if (before && !after)
        updates.total_appointments = (0, config_1.Inc)(-1);
    // ── Contadores por status ─────────────────────────────────────────────
    const bStatus = before === null || before === void 0 ? void 0 : before.status;
    const aStatus = after === null || after === void 0 ? void 0 : after.status;
    const statusDeltas = {};
    if (bStatus && exports.STATUS_FIELDS[bStatus]) {
        statusDeltas[exports.STATUS_FIELDS[bStatus]] = -1;
    }
    if (aStatus && exports.STATUS_FIELDS[aStatus]) {
        const field = exports.STATUS_FIELDS[aStatus];
        statusDeltas[field] = (statusDeltas[field] || 0) + 1;
    }
    for (const [field, delta] of Object.entries(statusDeltas)) {
        if (delta !== 0)
            updates[field] = (0, config_1.Inc)(delta);
    }
    // ── Breakdowns ────────────────────────────────────────────────────────
    const isTrackedStatus = (s) => s === 'completed' || s === 'cancelled' || s === 'no_show';
    const wasTracked = isTrackedStatus(bStatus);
    const isTracked = isTrackedStatus(aStatus);
    if (wasTracked || isTracked) {
        let totalProductionDelta = 0;
        const profAcc = {};
        const svcAcc = {};
        const partAcc = {};
        const profSvcAcc = {};
        const profPartAcc = {};
        const acc = (map, id) => {
            if (!map[id])
                map[id] = { nums: {} };
            return map[id];
        };
        const applyStats = (docData, status, multiplier) => {
            var _a, _b, _c;
            const appt = docData;
            const pId = appt.professional_id;
            const sId = appt.service_id;
            const partnId = appt.partnership_id;
            const billing = (0, summaryCore_1.classifyAppointment)(appt);
            const price = (0, summaryCore_1.effectivePrice)(appt);
            const isComp = status === 'completed' ? multiplier : 0;
            const isCanc = status === 'cancelled' ? multiplier : 0;
            const isNoSh = status === 'no_show' ? multiplier : 0;
            const productionDelta = status === 'completed' ? price * multiplier : 0;
            const revenueDelta = status === 'completed' && billing === 'independent'
                ? price * multiplier
                : 0;
            const sessionField = billing === 'package'
                ? 'package_sessions'
                : billing === 'subscription'
                    ? 'subscription_sessions'
                    : 'independent_sessions';
            totalProductionDelta += productionDelta;
            const applyTo = (a, completedField) => {
                addNum(a, completedField, isComp);
                addNum(a, 'cancelled', isCanc);
                addNum(a, 'no_show', isNoSh);
                addNum(a, 'production_value', productionDelta);
                addNum(a, 'revenue', revenueDelta);
                if (isComp !== 0)
                    addNum(a, sessionField, isComp);
            };
            if (pId) {
                const a = acc(profAcc, pId);
                if (multiplier > 0)
                    a.name = ((_a = appt.professionals) === null || _a === void 0 ? void 0 : _a.name) || a.name;
                applyTo(a, 'completed');
                if (sId)
                    applyTo(acc(profSvcAcc, `${pId}_${sId}`), 'completed');
                if (partnId)
                    applyTo(acc(profPartAcc, `${pId}_${partnId}`), 'completed');
            }
            if (sId) {
                const a = acc(svcAcc, sId);
                if (multiplier > 0)
                    a.name = ((_b = appt.services) === null || _b === void 0 ? void 0 : _b.name) || a.name;
                applyTo(a, 'count');
            }
            if (partnId) {
                const a = acc(partAcc, partnId);
                if (multiplier > 0)
                    a.name = ((_c = appt.partnerships) === null || _c === void 0 ? void 0 : _c.name) || a.name;
                applyTo(a, 'sessionCount');
            }
        };
        if (wasTracked && before)
            applyStats(before, bStatus, -1);
        if (isTracked && after)
            applyStats(after, aStatus, 1);
        const buildUpdate = (accMap) => {
            const obj = {};
            for (const [id, a] of Object.entries(accMap)) {
                const entry = {};
                if (a.name)
                    entry.name = a.name;
                for (const [field, delta] of Object.entries(a.nums)) {
                    if (delta !== 0)
                        entry[field] = (0, config_1.Inc)(delta);
                }
                if (Object.keys(entry).length > 0)
                    obj[id] = entry;
            }
            return obj;
        };
        const profObj = buildUpdate(profAcc);
        if (Object.keys(profObj).length > 0)
            updates.by_professional = profObj;
        const svcObj = buildUpdate(svcAcc);
        if (Object.keys(svcObj).length > 0)
            updates.by_service = svcObj;
        const partObj = buildUpdate(partAcc);
        if (Object.keys(partObj).length > 0)
            updates.by_partnership = partObj;
        const profSvcObj = buildUpdate(profSvcAcc);
        if (Object.keys(profSvcObj).length > 0)
            updates.by_professional_service = profSvcObj;
        const profPartObj = buildUpdate(profPartAcc);
        if (Object.keys(profPartObj).length > 0)
            updates.by_professional_partnership = profPartObj;
        if (totalProductionDelta !== 0)
            updates.total_production_value = (0, config_1.Inc)(totalProductionDelta);
    }
    const hasReal = Object.keys(updates).some((k) => k !== 'updated_at');
    return hasReal ? updates : null;
}
//# sourceMappingURL=helpers.js.map
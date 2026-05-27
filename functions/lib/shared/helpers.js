"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATUS_FIELDS = void 0;
exports.monthKeyOf = monthKeyOf;
exports.summaryRef = summaryRef;
exports.appointmentDelta = appointmentDelta;
const date_fns_1 = require("date-fns");
const config_1 = require("../config");
function monthKeyOf(isoDate) {
    const d = new Date(isoDate);
    return isNaN(d.getTime()) ? null : (0, date_fns_1.format)(d, 'yyyy-MM');
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
function appointmentDelta(before, after) {
    const updates = {
        updated_at: (0, config_1.ServerTs)(),
    };
    // ── Contagem total de agendamentos ────────────────────────────────────
    if (after && !before)
        updates.total_appointments = (0, config_1.Inc)(1); // criação
    if (before && !after)
        updates.total_appointments = (0, config_1.Inc)(-1); // deleção
    // ── Contadores por status ─────────────────────────────────────────────
    const bStatus = before === null || before === void 0 ? void 0 : before.status;
    const aStatus = after === null || after === void 0 ? void 0 : after.status;
    // Acumula deltas por campo para evitar dupla atribuição no mesmo key
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
    // ── Breakdowns (by_professional, by_service, by_partnership e matrizes cruzadas)
    const isTrackedStatus = (s) => s === 'completed' || s === 'cancelled' || s === 'no_show';
    const wasTracked = isTrackedStatus(bStatus);
    const isTracked = isTrackedStatus(aStatus);
    if (wasTracked || isTracked) {
        const profAcc = {};
        const svcAcc = {};
        const partAcc = {};
        const profSvcAcc = {};
        const profPartAcc = {};
        const applyStats = (docData, status, multiplier) => {
            var _a, _b, _c, _d, _e;
            const pId = docData.professional_id;
            const sId = docData.service_id;
            const price = ((_a = docData.services) === null || _a === void 0 ? void 0 : _a.price) || 0;
            const partnId = docData.partnership_id;
            const isComp = status === 'completed' ? multiplier : 0;
            const isCanc = status === 'cancelled' ? multiplier : 0;
            const isNoSh = status === 'no_show' ? multiplier : 0;
            const revDelta = status === 'completed' ? price * multiplier : 0;
            if (pId) {
                profAcc[pId] = profAcc[pId] || { name: ((_b = docData.professionals) === null || _b === void 0 ? void 0 : _b.name) || '', completed: 0, cancelled: 0, no_show: 0, revenue: 0 };
                if (multiplier > 0)
                    profAcc[pId].name = ((_c = docData.professionals) === null || _c === void 0 ? void 0 : _c.name) || profAcc[pId].name;
                profAcc[pId].completed += isComp;
                profAcc[pId].cancelled += isCanc;
                profAcc[pId].no_show += isNoSh;
                profAcc[pId].revenue += revDelta;
                if (sId) {
                    const crossId = `${pId}_${sId}`;
                    profSvcAcc[crossId] = profSvcAcc[crossId] || { completed: 0, cancelled: 0, no_show: 0, revenue: 0 };
                    profSvcAcc[crossId].completed += isComp;
                    profSvcAcc[crossId].cancelled += isCanc;
                    profSvcAcc[crossId].no_show += isNoSh;
                    profSvcAcc[crossId].revenue += revDelta;
                }
                if (partnId) {
                    const crossId = `${pId}_${partnId}`;
                    profPartAcc[crossId] = profPartAcc[crossId] || { completed: 0, cancelled: 0, no_show: 0, revenue: 0 };
                    profPartAcc[crossId].completed += isComp;
                    profPartAcc[crossId].cancelled += isCanc;
                    profPartAcc[crossId].no_show += isNoSh;
                    profPartAcc[crossId].revenue += revDelta;
                }
            }
            if (sId) {
                svcAcc[sId] = svcAcc[sId] || { name: ((_d = docData.services) === null || _d === void 0 ? void 0 : _d.name) || '', count: 0, cancelled: 0, no_show: 0, revenue: 0 };
                if (multiplier > 0)
                    svcAcc[sId].name = ((_e = docData.services) === null || _e === void 0 ? void 0 : _e.name) || svcAcc[sId].name;
                svcAcc[sId].count += isComp;
                svcAcc[sId].cancelled += isCanc;
                svcAcc[sId].no_show += isNoSh;
                svcAcc[sId].revenue += revDelta;
            }
            if (partnId) {
                partAcc[partnId] = partAcc[partnId] || { sessionCount: 0, cancelled: 0, no_show: 0, revenue: 0 };
                partAcc[partnId].sessionCount += isComp;
                partAcc[partnId].cancelled += isCanc;
                partAcc[partnId].no_show += isNoSh;
                partAcc[partnId].revenue += revDelta;
            }
        };
        if (wasTracked && before) {
            applyStats(before, bStatus, -1);
        }
        if (isTracked && after) {
            applyStats(after, aStatus, 1);
        }
        const buildUpdate = (acc, nameField = null, countField = 'completed') => {
            const obj = {};
            for (const [id, d] of Object.entries(acc)) {
                if (d[countField] !== 0 || d.revenue !== 0 || d.cancelled !== 0 || d.no_show !== 0) {
                    obj[id] = {};
                    if (nameField && d[nameField])
                        obj[id][nameField] = d[nameField];
                    if (d[countField] !== 0)
                        obj[id][countField] = (0, config_1.Inc)(d[countField]);
                    if (d.cancelled !== 0)
                        obj[id].cancelled = (0, config_1.Inc)(d.cancelled);
                    if (d.no_show !== 0)
                        obj[id].no_show = (0, config_1.Inc)(d.no_show);
                    if (d.revenue !== 0)
                        obj[id].revenue = (0, config_1.Inc)(d.revenue);
                }
            }
            return obj;
        };
        const profObj = buildUpdate(profAcc, 'name', 'completed');
        if (Object.keys(profObj).length > 0)
            updates.by_professional = profObj;
        const svcObj = buildUpdate(svcAcc, 'name', 'count');
        if (Object.keys(svcObj).length > 0)
            updates.by_service = svcObj;
        const partObj = buildUpdate(partAcc, null, 'sessionCount');
        if (Object.keys(partObj).length > 0)
            updates.by_partnership = partObj;
        const profSvcObj = buildUpdate(profSvcAcc, null, 'completed');
        if (Object.keys(profSvcObj).length > 0)
            updates.by_professional_service = profSvcObj;
        const profPartObj = buildUpdate(profPartAcc, null, 'completed');
        if (Object.keys(profPartObj).length > 0)
            updates.by_professional_partnership = profPartObj;
    }
    const hasReal = Object.keys(updates).some((k) => k !== 'updated_at');
    return hasReal ? updates : null;
}
//# sourceMappingURL=helpers.js.map
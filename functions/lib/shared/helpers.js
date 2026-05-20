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
    var _a, _b, _c, _d, _e, _f, _g, _h;
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
    // ── Breakdowns (by_professional, by_service, by_partnership) ──────────
    // Breakdowns contam apenas appointments COMPLETED.
    const wasCompleted = bStatus === 'completed';
    const isCompleted = aStatus === 'completed';
    if (wasCompleted || isCompleted) {
        // Acumula deltas numéricos por ID antes de converter em FieldValue
        const profAcc = {};
        const svcAcc = {};
        const partAcc = {};
        // Subtrair breakdown do estado anterior (se era completed)
        if (wasCompleted && before) {
            const pId = before.professional_id;
            const sId = before.service_id;
            const price = ((_a = before.services) === null || _a === void 0 ? void 0 : _a.price) || 0;
            const partnId = before.partnership_id;
            if (pId) {
                profAcc[pId] = profAcc[pId] || {
                    name: ((_b = before.professionals) === null || _b === void 0 ? void 0 : _b.name) || '',
                    completed: 0,
                    revenue: 0,
                };
                profAcc[pId].completed -= 1;
                profAcc[pId].revenue -= price;
            }
            if (sId) {
                svcAcc[sId] = svcAcc[sId] || {
                    name: ((_c = before.services) === null || _c === void 0 ? void 0 : _c.name) || '',
                    count: 0,
                    revenue: 0,
                };
                svcAcc[sId].count -= 1;
                svcAcc[sId].revenue -= price;
            }
            if (partnId) {
                partAcc[partnId] = partAcc[partnId] || { sessionCount: 0 };
                partAcc[partnId].sessionCount -= 1;
            }
        }
        // Adicionar breakdown do estado atual (se é completed)
        if (isCompleted && after) {
            const pId = after.professional_id;
            const sId = after.service_id;
            const price = ((_d = after.services) === null || _d === void 0 ? void 0 : _d.price) || 0;
            const partnId = after.partnership_id;
            if (pId) {
                profAcc[pId] = profAcc[pId] || {
                    name: ((_e = after.professionals) === null || _e === void 0 ? void 0 : _e.name) || '',
                    completed: 0,
                    revenue: 0,
                };
                // Prioriza o nome mais recente
                profAcc[pId].name =
                    ((_f = after.professionals) === null || _f === void 0 ? void 0 : _f.name) || profAcc[pId].name;
                profAcc[pId].completed += 1;
                profAcc[pId].revenue += price;
            }
            if (sId) {
                svcAcc[sId] = svcAcc[sId] || {
                    name: ((_g = after.services) === null || _g === void 0 ? void 0 : _g.name) || '',
                    count: 0,
                    revenue: 0,
                };
                svcAcc[sId].name =
                    ((_h = after.services) === null || _h === void 0 ? void 0 : _h.name) || svcAcc[sId].name;
                svcAcc[sId].count += 1;
                svcAcc[sId].revenue += price;
            }
            if (partnId) {
                partAcc[partnId] = partAcc[partnId] || { sessionCount: 0 };
                partAcc[partnId].sessionCount += 1;
            }
        }
        // Converter acumuladores em FieldValue.increment para o Firestore
        const profObj = {};
        for (const [id, d] of Object.entries(profAcc)) {
            if (d.completed !== 0 || d.revenue !== 0) {
                profObj[id] = { name: d.name };
                if (d.completed !== 0)
                    profObj[id].completed = (0, config_1.Inc)(d.completed);
                if (d.revenue !== 0)
                    profObj[id].revenue = (0, config_1.Inc)(d.revenue);
            }
        }
        if (Object.keys(profObj).length > 0)
            updates.by_professional = profObj;
        const svcObj = {};
        for (const [id, d] of Object.entries(svcAcc)) {
            if (d.count !== 0 || d.revenue !== 0) {
                svcObj[id] = { name: d.name };
                if (d.count !== 0)
                    svcObj[id].count = (0, config_1.Inc)(d.count);
                if (d.revenue !== 0)
                    svcObj[id].revenue = (0, config_1.Inc)(d.revenue);
            }
        }
        if (Object.keys(svcObj).length > 0)
            updates.by_service = svcObj;
        const partObj = {};
        for (const [id, d] of Object.entries(partAcc)) {
            if (d.sessionCount !== 0) {
                partObj[id] = { sessionCount: (0, config_1.Inc)(d.sessionCount) };
            }
        }
        if (Object.keys(partObj).length > 0)
            updates.by_partnership = partObj;
    }
    // Se o único campo é updated_at, não há mudança real → skip write
    const hasReal = Object.keys(updates).some((k) => k !== 'updated_at');
    return hasReal ? updates : null;
}
//# sourceMappingURL=helpers.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onFinancialRecordWrite = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const config_1 = require("../config");
const helpers_1 = require("../shared/helpers");
const isIndependent = (data) => !!data && !data.client_subscription_id && !data.client_package_id;
exports.onFinancialRecordWrite = (0, firestore_1.onDocumentWritten)({
    document: 'companies/{companyId}/financial_records/{recordId}',
    region: config_1.REGION,
}, async (event) => {
    var _a, _b, _c, _d;
    const companyId = event.params.companyId;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    const bDate = before === null || before === void 0 ? void 0 : before.payment_date;
    const aDate = after === null || after === void 0 ? void 0 : after.payment_date;
    const bMonth = bDate ? (0, helpers_1.monthKeyOf)(bDate) : null;
    const aMonth = aDate ? (0, helpers_1.monthKeyOf)(aDate) : null;
    if (!bMonth && !aMonth)
        return;
    // Helper: constroi delta de receita para um lado (+ ou -)
    const buildDelta = (data, sign) => {
        if (!data)
            return null;
        const amount = data.amount || 0;
        if (amount === 0)
            return null;
        const u = {
            updated_at: (0, config_1.ServerTs)(),
            total_revenue: (0, config_1.Inc)(sign * amount),
        };
        if (data.client_subscription_id) {
            u.subscriptions_revenue_received = (0, config_1.Inc)(sign * amount);
            u.subscriptions_paid_count = (0, config_1.Inc)(sign);
        }
        // Caixa avulso por profissional — mantido aqui (registros reais) para o
        // card "Faturamento Avulso" não depender do snapshot noturno do cron
        if (isIndependent(data) && data.professional_id) {
            u.by_professional = {
                [data.professional_id]: {
                    independent_revenue: (0, config_1.Inc)(sign * amount),
                },
            };
        }
        return u;
    };
    // Mesmo mês: calcula diferença líquida
    if (bMonth === aMonth && aMonth) {
        const bAmount = (before === null || before === void 0 ? void 0 : before.amount) || 0;
        const aAmount = (after === null || after === void 0 ? void 0 : after.amount) || 0;
        const diff = aAmount - bAmount;
        const wasSub = !!(before === null || before === void 0 ? void 0 : before.client_subscription_id);
        const isSub = !!(after === null || after === void 0 ? void 0 : after.client_subscription_id);
        const indDeltas = {};
        if (isIndependent(before) && (before === null || before === void 0 ? void 0 : before.professional_id)) {
            const pid = before.professional_id;
            indDeltas[pid] = (indDeltas[pid] || 0) - bAmount;
        }
        if (isIndependent(after) && (after === null || after === void 0 ? void 0 : after.professional_id)) {
            const pid = after.professional_id;
            indDeltas[pid] = (indDeltas[pid] || 0) + aAmount;
        }
        const indChanged = Object.values(indDeltas).some((d) => d !== 0);
        // Skip se nada mudou
        if (diff === 0 && wasSub === isSub && !indChanged)
            return;
        const updates = {
            updated_at: (0, config_1.ServerTs)(),
            month: aMonth,
        };
        if (diff !== 0)
            updates.total_revenue = (0, config_1.Inc)(diff);
        // Tratar mudanças na flag de subscription
        if (wasSub && !isSub) {
            updates.subscriptions_revenue_received = (0, config_1.Inc)(-bAmount);
            updates.subscriptions_paid_count = (0, config_1.Inc)(-1);
        }
        else if (!wasSub && isSub) {
            updates.subscriptions_revenue_received = (0, config_1.Inc)(aAmount);
            updates.subscriptions_paid_count = (0, config_1.Inc)(1);
        }
        else if (wasSub && isSub && diff !== 0) {
            updates.subscriptions_revenue_received = (0, config_1.Inc)(diff);
        }
        if (indChanged) {
            const byProf = {};
            for (const [pid, delta] of Object.entries(indDeltas)) {
                if (delta !== 0)
                    byProf[pid] = { independent_revenue: (0, config_1.Inc)(delta) };
            }
            updates.by_professional = byProf;
        }
        await (0, helpers_1.summaryRef)(companyId, aMonth).set(updates, { merge: true });
        return;
    }
    // Cross-month ou criação/deleção
    const writes = [];
    if (bMonth) {
        const removal = buildDelta(before, -1);
        if (removal) {
            removal.month = bMonth;
            writes.push((0, helpers_1.summaryRef)(companyId, bMonth).set(removal, { merge: true }));
        }
    }
    if (aMonth) {
        const addition = buildDelta(after, 1);
        if (addition) {
            addition.month = aMonth;
            writes.push((0, helpers_1.summaryRef)(companyId, aMonth).set(addition, { merge: true }));
        }
    }
    await Promise.all(writes);
});
//# sourceMappingURL=onFinancialRecordWrite.js.map
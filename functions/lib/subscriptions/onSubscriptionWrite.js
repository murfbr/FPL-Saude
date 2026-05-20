"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onSubscriptionWrite = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const config_1 = require("../config");
const helpers_1 = require("../shared/helpers");
const date_fns_1 = require("date-fns");
exports.onSubscriptionWrite = (0, firestore_1.onDocumentWritten)({
    document: 'companies/{companyId}/clients/{clientId}/subscriptions/{subscriptionId}',
    region: config_1.REGION,
}, async (event) => {
    var _a, _b, _c, _d, _e, _f;
    const companyId = event.params.companyId;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    const wasActive = (before === null || before === void 0 ? void 0 : before.status) === 'active';
    const isActive = (after === null || after === void 0 ? void 0 : after.status) === 'active';
    // Se o estado ativo não mudou, não precisa atualizar expected revenue
    if (wasActive === isActive)
        return;
    // Buscar preço do plano ou serviço (1 read)
    const sub = after || before;
    let price = 0;
    if (sub === null || sub === void 0 ? void 0 : sub.subscription_plan_id) {
        const planSnap = await config_1.db
            .collection('companies')
            .doc(companyId)
            .collection('subscription_plans')
            .doc(sub.subscription_plan_id)
            .get();
        price = ((_e = planSnap.data()) === null || _e === void 0 ? void 0 : _e.price) || 0;
    }
    else if (sub === null || sub === void 0 ? void 0 : sub.service_id) {
        const svcSnap = await config_1.db
            .collection('companies')
            .doc(companyId)
            .collection('services')
            .doc(sub.service_id)
            .get();
        price = ((_f = svcSnap.data()) === null || _f === void 0 ? void 0 : _f.price) || 0;
    }
    if (price === 0)
        return;
    // Proration: se a assinatura começou neste mês, calcular proporcional
    const now = new Date();
    if (sub === null || sub === void 0 ? void 0 : sub.start_date) {
        const startDate = new Date(sub.start_date);
        const isSameMonth = startDate.getFullYear() === now.getFullYear() &&
            startDate.getMonth() === now.getMonth();
        if (isSameMonth) {
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const daysActive = daysInMonth - startDate.getDate() + 1;
            price =
                Math.round(((price / daysInMonth) * daysActive * 100) / 100);
        }
    }
    const delta = isActive ? price : -price;
    const monthKey = (0, date_fns_1.format)(now, 'yyyy-MM');
    await (0, helpers_1.summaryRef)(companyId, monthKey).set({
        updated_at: (0, config_1.ServerTs)(),
        month: monthKey,
        expected_subscriptions_revenue: (0, config_1.Inc)(delta),
    }, { merge: true });
});
//# sourceMappingURL=onSubscriptionWrite.js.map
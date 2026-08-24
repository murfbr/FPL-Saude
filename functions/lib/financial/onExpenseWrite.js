"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onExpenseWrite = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const config_1 = require("../config");
const helpers_1 = require("../shared/helpers");
/**
 * Mantém total_expenses e expenses_by_category do monthly_summary a partir
 * das despesas. Regime de caixa (mesma régua do total_revenue): só despesa
 * com status 'paid' conta, no mês (America/Sao_Paulo) do payment_date.
 * O cron diário reconcilia integralmente via summaryCore — este trigger é o
 * espelho incremental, como onFinancialRecordWrite é para as entradas.
 */
const paidMonth = (data) => {
    if (!data || data.status !== 'paid' || !data.payment_date)
        return null;
    return (0, helpers_1.monthKeyOf)(data.payment_date);
};
const categoryEntry = (data, amountDelta) => ({
    [data.category_id || 'sem-categoria']: {
        name: data.category_name || 'Sem categoria',
        total: (0, config_1.Inc)(amountDelta),
    },
});
exports.onExpenseWrite = (0, firestore_1.onDocumentWritten)({
    document: 'companies/{companyId}/expenses/{expenseId}',
    region: config_1.REGION,
}, async (event) => {
    var _a, _b, _c, _d;
    const companyId = event.params.companyId;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    const bMonth = paidMonth(before);
    const aMonth = paidMonth(after);
    if (!bMonth && !aMonth)
        return;
    const bAmount = (before === null || before === void 0 ? void 0 : before.amount) || 0;
    const aAmount = (after === null || after === void 0 ? void 0 : after.amount) || 0;
    // Mesmo mês pago → delta líquido (valor e/ou categoria podem ter mudado)
    if (bMonth && aMonth && bMonth === aMonth) {
        const sameCategory = ((before === null || before === void 0 ? void 0 : before.category_id) || null) === ((after === null || after === void 0 ? void 0 : after.category_id) || null);
        const diff = aAmount - bAmount;
        if (diff === 0 && sameCategory)
            return;
        const updates = {
            updated_at: (0, config_1.ServerTs)(),
            month: aMonth,
        };
        if (diff !== 0)
            updates.total_expenses = (0, config_1.Inc)(diff);
        updates.expenses_by_category = sameCategory
            ? categoryEntry(after, diff)
            : Object.assign(Object.assign({}, categoryEntry(before, -bAmount)), categoryEntry(after, aAmount));
        await (0, helpers_1.summaryRef)(companyId, aMonth).set(updates, { merge: true });
        return;
    }
    // Transições: pagou / despagou / mudou o mês do pagamento
    const writes = [];
    if (bMonth) {
        writes.push((0, helpers_1.summaryRef)(companyId, bMonth).set({
            updated_at: (0, config_1.ServerTs)(),
            month: bMonth,
            total_expenses: (0, config_1.Inc)(-bAmount),
            expenses_by_category: categoryEntry(before, -bAmount),
        }, { merge: true }));
    }
    if (aMonth) {
        writes.push((0, helpers_1.summaryRef)(companyId, aMonth).set({
            updated_at: (0, config_1.ServerTs)(),
            month: aMonth,
            total_expenses: (0, config_1.Inc)(aAmount),
            expenses_by_category: categoryEntry(after, aAmount),
        }, { merge: true }));
    }
    await Promise.all(writes);
});
//# sourceMappingURL=onExpenseWrite.js.map
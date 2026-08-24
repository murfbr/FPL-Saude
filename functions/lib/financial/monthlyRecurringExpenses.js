"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monthlyRecurringExpenses = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const config_1 = require("../config");
const summaryCore_1 = require("../shared/summaryCore");
/**
 * Todo dia 1º (4h, America/Sao_Paulo): para cada despesa recorrente lançada no
 * mês anterior, cria o lançamento do mês corrente como 'pending', com o mesmo
 * dia de vencimento.
 *
 * Idempotência: o ID do lançamento gerado é rec_<raiz>_<YYYY-MM> — a raiz é a
 * despesa original da série (recurrence_source_id, ou o próprio id na
 * primeira). Rodar duas vezes, ou o admin já ter criado à mão, não duplica.
 */
exports.monthlyRecurringExpenses = (0, scheduler_1.onSchedule)({
    schedule: '0 4 1 * *',
    region: config_1.REGION,
    timeZone: 'America/Sao_Paulo',
}, async () => {
    const monthKey = (0, summaryCore_1.currentMonthKey)(new Date());
    const prevKey = (0, summaryCore_1.previousMonthKey)(monthKey);
    const companies = await config_1.db.collection('companies').listDocuments();
    let created = 0;
    for (const companyRef of companies) {
        const snap = await companyRef
            .collection('expenses')
            .where('is_recurring', '==', true)
            .get();
        for (const docSnap of snap.docs) {
            const e = docSnap.data();
            // Gera a partir do lançamento do MÊS ANTERIOR (o elo mais recente da série)
            const dueMonth = (e.due_date || '').slice(0, 7);
            if (dueMonth !== prevKey)
                continue;
            const rootId = e.recurrence_source_id || docSnap.id;
            const newRef = companyRef
                .collection('expenses')
                .doc(`rec_${rootId}_${monthKey}`);
            const existing = await newRef.get();
            if (existing.exists)
                continue;
            const dueDay = e.due_date.slice(8, 10);
            const [y, m] = monthKey.split('-').map(Number);
            const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
            const day = Math.min(Number(dueDay) || 1, lastDay);
            await newRef.set({
                id: newRef.id,
                description: e.description || '',
                amount: e.amount || 0,
                category_id: e.category_id || null,
                category_name: e.category_name || null,
                supplier_name: e.supplier_name || null,
                status: 'pending',
                due_date: `${monthKey}-${String(day).padStart(2, '0')}`,
                payment_date: null,
                payment_method: null,
                is_recurring: true,
                recurrence_source_id: rootId,
                notes: e.notes || null,
                created_at: new Date().toISOString(),
                created_by: 'recurring-cron',
            });
            created++;
        }
    }
    console.log(`[recurring-expenses] ${monthKey}: ${created} lançamento(s) gerado(s) em ${companies.length} empresa(s)`);
});
//# sourceMappingURL=monthlyRecurringExpenses.js.map
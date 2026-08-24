"use strict";
/**
 * Núcleo puro da agregação de monthly_summaries — fonte única de verdade.
 *
 * Três chamadores: trigger incremental (appointmentDelta), reconciliação
 * diária (cron) e backfill (scripts/). Qualquer mudança de semântica de
 * campo acontece AQUI, nunca nos chamadores.
 *
 * Sem imports de propósito: o módulo precisa rodar em Cloud Functions
 * (commonjs/tsc), no Vitest da raiz e em scripts tsx sem nenhuma
 * dependência além do runtime JS.
 *
 * Semântica dos campos de valor (decisão de produto, ago/2026):
 *   revenue          → CAIXA avulso: preço efetivo (com desconto) das sessões
 *                      independentes concluídas — espelha os financial_records
 *                      que essas sessões geram.
 *   production_value → PRODUÇÃO: preço efetivo de TODA sessão concluída,
 *                      inclusive coberta por pacote/assinatura.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SP_UTC_OFFSET_MS = void 0;
exports.monthKeyOf = monthKeyOf;
exports.dayKeyOf = dayKeyOf;
exports.currentMonthKey = currentMonthKey;
exports.previousMonthKey = previousMonthKey;
exports.monthRangeUtc = monthRangeUtc;
exports.lastDayOfMonth = lastDayOfMonth;
exports.classifyAppointment = classifyAppointment;
exports.effectivePrice = effectivePrice;
exports.subscriptionCoversMonth = subscriptionCoversMonth;
exports.subscriptionKeysForMonth = subscriptionKeysForMonth;
exports.buildMonthlySummary = buildMonthlySummary;
// America/Sao_Paulo é UTC-3 fixo desde a abolição do horário de verão (2019).
// Quando o fuso virar configuração por tenant (financial_config), este offset
// vira parâmetro — até lá, é a única constante de fuso do sistema.
exports.SP_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
// ─────────────────────────────────────────────────────────────────────────────
// Datas — bucketing SEMPRE no fuso de São Paulo
// ─────────────────────────────────────────────────────────────────────────────
/** 'YYYY-MM' do instante ISO no fuso de São Paulo (null se inválido). */
function monthKeyOf(iso) {
    const t = Date.parse(iso);
    if (Number.isNaN(t))
        return null;
    return new Date(t - exports.SP_UTC_OFFSET_MS).toISOString().slice(0, 7);
}
/** 'YYYY-MM-DD' do instante ISO no fuso de São Paulo (null se inválido). */
function dayKeyOf(iso) {
    const t = Date.parse(iso);
    if (Number.isNaN(t))
        return null;
    return new Date(t - exports.SP_UTC_OFFSET_MS).toISOString().slice(0, 10);
}
/** 'YYYY-MM' do relógio de agora no fuso de São Paulo. */
function currentMonthKey(now) {
    return new Date(now.getTime() - exports.SP_UTC_OFFSET_MS).toISOString().slice(0, 7);
}
/** Chave do mês anterior a uma chave 'YYYY-MM'. */
function previousMonthKey(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    return d.toISOString().slice(0, 7);
}
/**
 * Janela UTC [startIso, endIso] que corresponde ao mês-calendário de São
 * Paulo. Usada nas queries por payment_date / schedules.start_time.
 */
function monthRangeUtc(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1) + exports.SP_UTC_OFFSET_MS);
    const end = new Date(Date.UTC(y, m, 1) + exports.SP_UTC_OFFSET_MS - 1);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
}
/** Último dia ('YYYY-MM-DD') de uma chave de mês. */
function lastDayOfMonth(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
// ─────────────────────────────────────────────────────────────────────────────
// Classificação e preço
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Classifica a sessão. `billing_type` (gravado na conclusão) tem prioridade;
 * o fallback heurístico cobre documentos anteriores à denormalização.
 * `subscriptionKeys` (opcional) = Set de `${client_id}_${service_id}` das
 * assinaturas VIGENTES no mês analisado.
 */
function classifyAppointment(appt, subscriptionKeys) {
    var _a;
    const bt = appt.billing_type;
    if (bt === 'package' || bt === 'subscription' || bt === 'independent')
        return bt;
    if (appt.entry_type === 'event')
        return 'independent';
    if (appt.client_package_id)
        return 'package';
    if (((_a = appt.services) === null || _a === void 0 ? void 0 : _a.value_type) === 'monthly')
        return 'subscription';
    if (subscriptionKeys &&
        appt.client_id &&
        appt.service_id &&
        subscriptionKeys.has(`${appt.client_id}_${appt.service_id}`)) {
        return 'subscription';
    }
    return 'independent';
}
/** Preço efetivo da sessão: com desconto, nunca negativo; eventos usam event_price. */
function effectivePrice(appt) {
    var _a;
    if (appt.entry_type === 'event')
        return appt.event_price || 0;
    const price = ((_a = appt.services) === null || _a === void 0 ? void 0 : _a.price) || 0;
    const discount = appt.discount_amount || 0;
    return Math.max(0, price - discount);
}
/**
 * Vigência de assinatura num mês, por data de CALENDÁRIO (imune a fuso):
 * compara apenas o trecho 'YYYY-MM-DD' das ISO strings.
 */
function subscriptionCoversMonth(sub, monthKey) {
    const firstDay = `${monthKey}-01`;
    const lastDay = lastDayOfMonth(monthKey);
    const start10 = (sub.start_date || '').slice(0, 10);
    const endIso = sub.end_date || sub.cancelled_at;
    const end10 = endIso ? endIso.slice(0, 10) : null;
    if (start10 && start10 > lastDay)
        return false;
    if (end10 && end10 < firstDay)
        return false;
    // Dado sujo: sem data de fim e status não-ativo — não considerar vigente
    if (!end10 && sub.status && sub.status !== 'active')
        return false;
    return true;
}
/** Set `${client_id}_${service_id}` das assinaturas vigentes no mês. */
function subscriptionKeysForMonth(subs, monthKey) {
    const keys = new Set();
    for (const sub of subs) {
        if (!sub.client_id || !sub.service_id)
            continue;
        if (subscriptionCoversMonth(sub, monthKey))
            keys.add(`${sub.client_id}_${sub.service_id}`);
    }
    return keys;
}
function emptyStats() {
    return {
        completed: 0,
        cancelled: 0,
        no_show: 0,
        revenue: 0,
        production_value: 0,
        package_sessions: 0,
        subscription_sessions: 0,
        independent_sessions: 0,
    };
}
function buildMonthlySummary(input) {
    var _a, _b, _c;
    const { monthKey, appointments, financialRecords, subscriptionKeys, partnershipNames, expenses, } = input;
    // Saídas — regime de caixa: só despesa PAGA, no mês do pagamento
    let totalExpenses = 0;
    const expensesByCategory = {};
    for (const e of expenses || []) {
        if (e.status !== 'paid')
            continue;
        const eAmount = e.amount || 0;
        totalExpenses += eAmount;
        const catId = e.category_id || 'sem-categoria';
        if (!expensesByCategory[catId]) {
            expensesByCategory[catId] = {
                name: e.category_name || 'Sem categoria',
                total: 0,
            };
        }
        expensesByCategory[catId].total += eAmount;
    }
    // 1. financial_records — caixa real
    let totalRevenue = 0;
    let subscriptionsRevenue = 0;
    let subscriptionsPaidCount = 0;
    const independentRevenueByProfessional = {};
    for (const f of financialRecords) {
        const amount = f.amount || 0;
        totalRevenue += amount;
        if (f.client_subscription_id) {
            subscriptionsRevenue += amount;
            subscriptionsPaidCount++;
        }
        if (!f.client_package_id &&
            !f.client_subscription_id &&
            f.professional_id) {
            independentRevenueByProfessional[f.professional_id] =
                (independentRevenueByProfessional[f.professional_id] || 0) + amount;
        }
    }
    // 2. appointments — operacional e produção
    let completed = 0;
    let cancelled = 0;
    let noShow = 0;
    let total = 0;
    let totalProduction = 0;
    const byProfessional = {};
    const byService = {};
    const byPartnership = {};
    const byProfSvc = {};
    const byProfPart = {};
    const partnershipClients = {};
    for (const a of appointments) {
        total++;
        const profId = a.professional_id || '';
        const svcId = a.service_id || '';
        const partId = a.partnership_id || null;
        const billing = classifyAppointment(a, subscriptionKeys);
        const price = effectivePrice(a);
        if (profId && !byProfessional[profId]) {
            byProfessional[profId] = Object.assign(Object.assign({}, emptyStats()), { name: ((_a = a.professionals) === null || _a === void 0 ? void 0 : _a.name) || 'Desconhecido', independent_revenue: independentRevenueByProfessional[profId] || 0 });
        }
        if (svcId && !byService[svcId]) {
            byService[svcId] = Object.assign(Object.assign({}, emptyStats()), { name: ((_b = a.services) === null || _b === void 0 ? void 0 : _b.name) || 'Serviço Removido', count: 0 });
        }
        if (partId && !byPartnership[partId]) {
            byPartnership[partId] = Object.assign(Object.assign({}, emptyStats()), { name: (partnershipNames === null || partnershipNames === void 0 ? void 0 : partnershipNames[partId]) || ((_c = a.partnerships) === null || _c === void 0 ? void 0 : _c.name) || '', clientCount: 0, sessionCount: 0 });
            partnershipClients[partId] = new Set();
        }
        const crossSvc = profId && svcId ? `${profId}_${svcId}` : null;
        if (crossSvc && !byProfSvc[crossSvc]) {
            byProfSvc[crossSvc] = Object.assign(Object.assign({}, emptyStats()), { independent_revenue: 0 });
        }
        const crossPart = profId && partId ? `${profId}_${partId}` : null;
        if (crossPart && !byProfPart[crossPart]) {
            byProfPart[crossPart] = Object.assign(Object.assign({}, emptyStats()), { independent_revenue: 0 });
        }
        const targets = [];
        if (profId)
            targets.push(byProfessional[profId]);
        if (svcId)
            targets.push(byService[svcId]);
        if (partId)
            targets.push(byPartnership[partId]);
        if (crossSvc)
            targets.push(byProfSvc[crossSvc]);
        if (crossPart)
            targets.push(byProfPart[crossPart]);
        if (a.status === 'completed') {
            completed++;
            totalProduction += price;
            for (const t of targets) {
                t.completed++;
                t.production_value += price;
                if (billing === 'package')
                    t.package_sessions++;
                else if (billing === 'subscription')
                    t.subscription_sessions++;
                else {
                    t.independent_sessions++;
                    t.revenue += price;
                }
            }
            if (svcId)
                byService[svcId].count++;
            if (partId) {
                byPartnership[partId].sessionCount++;
                if (a.client_id)
                    partnershipClients[partId].add(a.client_id);
            }
            if (billing === 'independent') {
                if (crossSvc)
                    byProfSvc[crossSvc].independent_revenue += price;
                if (crossPart)
                    byProfPart[crossPart].independent_revenue += price;
            }
        }
        else if (a.status === 'cancelled') {
            cancelled++;
            for (const t of targets)
                t.cancelled++;
        }
        else if (a.status === 'no_show') {
            noShow++;
            for (const t of targets)
                t.no_show++;
        }
    }
    // Profissionais que só têm receita avulsa em records (sem agendamentos no mês)
    for (const [profId, rev] of Object.entries(independentRevenueByProfessional)) {
        if (!byProfessional[profId]) {
            byProfessional[profId] = Object.assign(Object.assign({}, emptyStats()), { name: 'Profissional', independent_revenue: rev });
        }
    }
    for (const [partId, clients] of Object.entries(partnershipClients)) {
        byPartnership[partId].clientCount = clients.size;
    }
    return {
        month: monthKey,
        total_revenue: totalRevenue,
        total_production_value: totalProduction,
        total_expenses: totalExpenses,
        expenses_by_category: expensesByCategory,
        completed_appointments: completed,
        cancelled_appointments: cancelled,
        no_show_appointments: noShow,
        total_appointments: total,
        subscriptions_revenue_received: subscriptionsRevenue,
        subscriptions_paid_count: subscriptionsPaidCount,
        by_professional: byProfessional,
        by_service: byService,
        by_partnership: byPartnership,
        by_professional_service: byProfSvc,
        by_professional_partnership: byProfPart,
    };
}
//# sourceMappingURL=summaryCore.js.map
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyReconciliation = exports.onSubscriptionWrite = exports.onFinancialRecordWrite = exports.onAppointmentWrite = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const date_fns_1 = require("date-fns");
admin.initializeApp();
const db = admin.firestore();
const REGION = 'southamerica-east1';
const Inc = admin.firestore.FieldValue.increment;
const ServerTs = admin.firestore.FieldValue.serverTimestamp;
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function monthKeyOf(isoDate) {
    const d = new Date(isoDate);
    return isNaN(d.getTime()) ? null : (0, date_fns_1.format)(d, 'yyyy-MM');
}
function summaryRef(companyId, monthKey) {
    return db
        .collection('companies')
        .doc(companyId)
        .collection('monthly_summaries')
        .doc(monthKey);
}
// ─────────────────────────────────────────────────────────────────────────────
// Appointment Delta (incremental)
//
// Em vez de ler TODOS os appointments do mês, calcula apenas o DELTA (before
// vs after) e aplica via FieldValue.increment(). Custo: 0 reads de appointments.
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_FIELDS = {
    completed: 'completed_appointments',
    cancelled: 'cancelled_appointments',
    no_show: 'no_show_appointments',
};
/**
 * Calcula o objeto de delta para set({merge:true}) no sumário mensal.
 * Retorna null se não houver nenhuma alteração real.
 *
 * @param before Dados do doc ANTES da escrita (undefined se criação)
 * @param after  Dados do doc DEPOIS da escrita (undefined se deleção)
 */
function appointmentDelta(before, after) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const updates = {
        updated_at: ServerTs(),
    };
    // ── Contagem total de agendamentos ────────────────────────────────────
    if (after && !before)
        updates.total_appointments = Inc(1); // criação
    if (before && !after)
        updates.total_appointments = Inc(-1); // deleção
    // ── Contadores por status ─────────────────────────────────────────────
    const bStatus = before === null || before === void 0 ? void 0 : before.status;
    const aStatus = after === null || after === void 0 ? void 0 : after.status;
    // Acumula deltas por campo para evitar dupla atribuição no mesmo key
    const statusDeltas = {};
    if (bStatus && STATUS_FIELDS[bStatus]) {
        statusDeltas[STATUS_FIELDS[bStatus]] = -1;
    }
    if (aStatus && STATUS_FIELDS[aStatus]) {
        const field = STATUS_FIELDS[aStatus];
        statusDeltas[field] = (statusDeltas[field] || 0) + 1;
    }
    for (const [field, delta] of Object.entries(statusDeltas)) {
        if (delta !== 0)
            updates[field] = Inc(delta);
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
                    profObj[id].completed = Inc(d.completed);
                if (d.revenue !== 0)
                    profObj[id].revenue = Inc(d.revenue);
            }
        }
        if (Object.keys(profObj).length > 0)
            updates.by_professional = profObj;
        const svcObj = {};
        for (const [id, d] of Object.entries(svcAcc)) {
            if (d.count !== 0 || d.revenue !== 0) {
                svcObj[id] = { name: d.name };
                if (d.count !== 0)
                    svcObj[id].count = Inc(d.count);
                if (d.revenue !== 0)
                    svcObj[id].revenue = Inc(d.revenue);
            }
        }
        if (Object.keys(svcObj).length > 0)
            updates.by_service = svcObj;
        const partObj = {};
        for (const [id, d] of Object.entries(partAcc)) {
            if (d.sessionCount !== 0) {
                partObj[id] = { sessionCount: Inc(d.sessionCount) };
            }
        }
        if (Object.keys(partObj).length > 0)
            updates.by_partnership = partObj;
    }
    // Se o único campo é updated_at, não há mudança real → skip write
    const hasReal = Object.keys(updates).some((k) => k !== 'updated_at');
    return hasReal ? updates : null;
}
// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER: onAppointmentWrite (incremental)
//
// ANTES:  ~190 reads por execução (query range ALL appointments + ALL fin_records)
// AGORA:  0 reads (apenas 1 write via set+merge com FieldValue.increment)
// ─────────────────────────────────────────────────────────────────────────────
exports.onAppointmentWrite = (0, firestore_1.onDocumentWritten)({
    document: 'companies/{companyId}/appointments/{appointmentId}',
    region: REGION,
}, async (event) => {
    var _a, _b, _c, _d, _e, _f;
    const companyId = event.params.companyId;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    const bMonth = ((_e = before === null || before === void 0 ? void 0 : before.schedules) === null || _e === void 0 ? void 0 : _e.start_time)
        ? monthKeyOf(before.schedules.start_time)
        : null;
    const aMonth = ((_f = after === null || after === void 0 ? void 0 : after.schedules) === null || _f === void 0 ? void 0 : _f.start_time)
        ? monthKeyOf(after.schedules.start_time)
        : null;
    if (!bMonth && !aMonth)
        return;
    // Caso comum: mesmo mês (criação, atualização de status, etc.)
    if (bMonth === aMonth && aMonth) {
        const delta = appointmentDelta(before, after);
        if (delta) {
            delta.month = aMonth;
            await summaryRef(companyId, aMonth).set(delta, { merge: true });
        }
        return;
    }
    // Cross-month: reagendamento entre meses ou criação/deleção
    const writes = [];
    if (bMonth) {
        // Remover do mês antigo (trata como deleção naquele mês)
        const removal = appointmentDelta(before, undefined);
        if (removal) {
            removal.month = bMonth;
            writes.push(summaryRef(companyId, bMonth).set(removal, { merge: true }));
        }
    }
    if (aMonth) {
        // Adicionar no mês novo (trata como criação naquele mês)
        const addition = appointmentDelta(undefined, after);
        if (addition) {
            addition.month = aMonth;
            writes.push(summaryRef(companyId, aMonth).set(addition, { merge: true }));
        }
    }
    await Promise.all(writes);
});
// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER: onFinancialRecordWrite (incremental)
//
// ANTES:  ~190 reads por execução (recalculava tudo inclusive appointments)
// AGORA:  0 reads (apenas 1 write com incremento/decremento da receita)
// ─────────────────────────────────────────────────────────────────────────────
exports.onFinancialRecordWrite = (0, firestore_1.onDocumentWritten)({
    document: 'companies/{companyId}/financial_records/{recordId}',
    region: REGION,
}, async (event) => {
    var _a, _b, _c, _d;
    const companyId = event.params.companyId;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    const bDate = before === null || before === void 0 ? void 0 : before.payment_date;
    const aDate = after === null || after === void 0 ? void 0 : after.payment_date;
    const bMonth = bDate ? monthKeyOf(bDate) : null;
    const aMonth = aDate ? monthKeyOf(aDate) : null;
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
            updated_at: ServerTs(),
            total_revenue: Inc(sign * amount),
        };
        if (data.client_subscription_id) {
            u.subscriptions_revenue_received = Inc(sign * amount);
            u.subscriptions_paid_count = Inc(sign);
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
        // Skip se nada mudou
        if (diff === 0 && wasSub === isSub)
            return;
        const updates = {
            updated_at: ServerTs(),
            month: aMonth,
        };
        if (diff !== 0)
            updates.total_revenue = Inc(diff);
        // Tratar mudanças na flag de subscription
        if (wasSub && !isSub) {
            updates.subscriptions_revenue_received = Inc(-bAmount);
            updates.subscriptions_paid_count = Inc(-1);
        }
        else if (!wasSub && isSub) {
            updates.subscriptions_revenue_received = Inc(aAmount);
            updates.subscriptions_paid_count = Inc(1);
        }
        else if (wasSub && isSub && diff !== 0) {
            updates.subscriptions_revenue_received = Inc(diff);
        }
        await summaryRef(companyId, aMonth).set(updates, { merge: true });
        return;
    }
    // Cross-month ou criação/deleção
    const writes = [];
    if (bMonth) {
        const removal = buildDelta(before, -1);
        if (removal) {
            removal.month = bMonth;
            writes.push(summaryRef(companyId, bMonth).set(removal, { merge: true }));
        }
    }
    if (aMonth) {
        const addition = buildDelta(after, 1);
        if (addition) {
            addition.month = aMonth;
            writes.push(summaryRef(companyId, aMonth).set(addition, { merge: true }));
        }
    }
    await Promise.all(writes);
});
// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER: onSubscriptionWrite (incremental)
//
// ANTES:  ~190 reads (recalculava TUDO incluindo appointments e fin_records)
// AGORA:  1 read (busca preço do plano/serviço) + 1 write
// ─────────────────────────────────────────────────────────────────────────────
exports.onSubscriptionWrite = (0, firestore_1.onDocumentWritten)({
    document: 'companies/{companyId}/clients/{clientId}/subscriptions/{subscriptionId}',
    region: REGION,
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
        const planSnap = await db
            .collection('companies')
            .doc(companyId)
            .collection('subscription_plans')
            .doc(sub.subscription_plan_id)
            .get();
        price = ((_e = planSnap.data()) === null || _e === void 0 ? void 0 : _e.price) || 0;
    }
    else if (sub === null || sub === void 0 ? void 0 : sub.service_id) {
        const svcSnap = await db
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
    await summaryRef(companyId, monthKey).set({
        updated_at: ServerTs(),
        month: monthKey,
        expected_subscriptions_revenue: Inc(delta),
    }, { merge: true });
});
// ─────────────────────────────────────────────────────────────────────────────
// RECONCILIAÇÃO COMPLETA (full recalculation)
//
// Roda 1x por dia via scheduled function (3h BRT).
// Reconstroi o sumário do zero para corrigir eventual drift do incremento.
// Este é o MESMO algoritmo que existia antes, mas agora roda apenas 1x/dia.
// ─────────────────────────────────────────────────────────────────────────────
async function fullRecalculation(companyId, month) {
    var _a, _b;
    const monthKey = (0, date_fns_1.format)(month, 'yyyy-MM');
    const startStr = (0, date_fns_1.startOfMonth)(month).toISOString();
    const endStr = (0, date_fns_1.endOfMonth)(month).toISOString();
    // 1. Buscar todos os agendamentos do mês
    const apptsSnap = await db
        .collection('companies')
        .doc(companyId)
        .collection('appointments')
        .where('schedules.start_time', '>=', startStr)
        .where('schedules.start_time', '<=', endStr)
        .get();
    // 2. Buscar registros financeiros do mês
    const finSnap = await db
        .collection('companies')
        .doc(companyId)
        .collection('financial_records')
        .where('payment_date', '>=', startStr)
        .where('payment_date', '<=', endStr)
        .get();
    // 3. Agregar appointments (contagem + breakdowns)
    let completedAppointments = 0;
    let cancelledAppointments = 0;
    let noShowAppointments = 0;
    let totalAppointments = 0;
    const byProfessional = {};
    const byService = {};
    const byPartnership = {};
    apptsSnap.forEach((docSnap) => {
        var _a, _b, _c;
        const a = docSnap.data();
        totalAppointments++;
        const profId = a.professional_id;
        const profName = ((_a = a.professionals) === null || _a === void 0 ? void 0 : _a.name) || 'Desconhecido';
        const serviceId = a.service_id;
        const serviceName = ((_b = a.services) === null || _b === void 0 ? void 0 : _b.name) || 'Serviço Removido';
        const price = ((_c = a.services) === null || _c === void 0 ? void 0 : _c.price) || 0;
        const partnershipId = a.partnership_id;
        if (!byProfessional[profId]) {
            byProfessional[profId] = { name: profName, completed: 0, revenue: 0 };
        }
        if (!byService[serviceId]) {
            byService[serviceId] = { name: serviceName, count: 0, revenue: 0 };
        }
        if (partnershipId) {
            if (!byPartnership[partnershipId]) {
                byPartnership[partnershipId] = {
                    name: '',
                    clientIds: new Set(),
                    sessionCount: 0,
                };
            }
        }
        if (a.status === 'completed') {
            completedAppointments++;
            byProfessional[profId].completed++;
            byProfessional[profId].revenue += price;
            byService[serviceId].count++;
            byService[serviceId].revenue += price;
            if (partnershipId) {
                byPartnership[partnershipId].clientIds.add(a.client_id);
                byPartnership[partnershipId].sessionCount++;
            }
        }
        else if (a.status === 'cancelled') {
            cancelledAppointments++;
        }
        else if (a.status === 'no_show') {
            noShowAppointments++;
        }
    });
    // 4. Agregar financial_records — receita REAL
    let totalRevenue = 0;
    let subscriptionsRevenue = 0;
    let subscriptionsPaidCount = 0;
    finSnap.forEach((docSnap) => {
        const f = docSnap.data();
        const amount = f.amount || 0;
        totalRevenue += amount;
        if (f.client_subscription_id) {
            subscriptionsRevenue += amount;
            subscriptionsPaidCount++;
        }
    });
    // 5. Calcular receita prevista de assinaturas ativas
    let expectedSubscriptionsRevenue = 0;
    const clientsSnap = await db
        .collection('companies')
        .doc(companyId)
        .collection('clients')
        .where('is_active', '==', true)
        .get();
    for (const clientDoc of clientsSnap.docs) {
        const subsSnap = await db
            .collection('companies')
            .doc(companyId)
            .collection('clients')
            .doc(clientDoc.id)
            .collection('subscriptions')
            .where('status', '==', 'active')
            .get();
        for (const subDoc of subsSnap.docs) {
            const sub = subDoc.data();
            let subPrice = 0;
            if (sub.subscription_plan_id) {
                const planSnap = await db
                    .collection('companies')
                    .doc(companyId)
                    .collection('subscription_plans')
                    .doc(sub.subscription_plan_id)
                    .get();
                subPrice = ((_a = planSnap.data()) === null || _a === void 0 ? void 0 : _a.price) || 0;
            }
            else if (sub.service_id) {
                const svcSnap = await db
                    .collection('companies')
                    .doc(companyId)
                    .collection('services')
                    .doc(sub.service_id)
                    .get();
                subPrice = ((_b = svcSnap.data()) === null || _b === void 0 ? void 0 : _b.price) || 0;
            }
            if (sub.start_date && subPrice > 0) {
                const startDate = new Date(sub.start_date);
                const isSameMonth = startDate.getFullYear() === month.getFullYear() &&
                    startDate.getMonth() === month.getMonth();
                if (isSameMonth) {
                    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
                    const daysActive = daysInMonth - startDate.getDate() + 1;
                    subPrice =
                        Math.round(((subPrice / daysInMonth) * daysActive * 100) / 100);
                }
            }
            expectedSubscriptionsRevenue += subPrice;
        }
    }
    // 6. Serializar Sets para contagens
    const byPartnershipSerialized = {};
    for (const [id, data] of Object.entries(byPartnership)) {
        byPartnershipSerialized[id] = {
            name: data.name,
            clientCount: data.clientIds.size,
            sessionCount: data.sessionCount,
        };
    }
    // 7. Persistir (sobrescreve completamente — é a verdade absoluta)
    await summaryRef(companyId, monthKey).set({
        month: monthKey,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        last_full_recalc: admin.firestore.FieldValue.serverTimestamp(),
        total_revenue: totalRevenue,
        completed_appointments: completedAppointments,
        cancelled_appointments: cancelledAppointments,
        no_show_appointments: noShowAppointments,
        total_appointments: totalAppointments,
        subscriptions_revenue_received: subscriptionsRevenue,
        subscriptions_paid_count: subscriptionsPaidCount,
        expected_subscriptions_revenue: expectedSubscriptionsRevenue,
        by_professional: byProfessional,
        by_service: byService,
        by_partnership: byPartnershipSerialized,
    });
    console.log(`[reconciliation] ${companyId}/${monthKey}: ${totalAppointments} appts, R$ ${totalRevenue.toFixed(2)}, expected subs R$ ${expectedSubscriptionsRevenue.toFixed(2)}`);
}
// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED: Reconciliação Diária (3h BRT)
//
// Roda a lógica completa (full recalculation) 1x por dia para corrigir
// qualquer drift acumulado pelo modelo incremental.
// ─────────────────────────────────────────────────────────────────────────────
exports.dailyReconciliation = (0, scheduler_1.onSchedule)({
    schedule: '0 3 * * *', // Cron: todo dia às 3h
    region: REGION,
    timeZone: 'America/Sao_Paulo',
}, async () => {
    const companiesSnap = await db.collection('companies').listDocuments();
    for (const companyRef of companiesSnap) {
        try {
            await fullRecalculation(companyRef.id, new Date());
        }
        catch (err) {
            console.error(`[reconciliation] Erro em ${companyRef.id}:`, err);
        }
    }
    console.log(`[reconciliation] Concluída para ${companiesSnap.length} empresa(s)`);
});
//# sourceMappingURL=index.js.map
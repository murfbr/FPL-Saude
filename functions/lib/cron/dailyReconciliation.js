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
exports.dailyReconciliation = void 0;
exports.fullRecalculation = fullRecalculation;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const date_fns_1 = require("date-fns");
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../config");
const helpers_1 = require("../shared/helpers");
async function fullRecalculation(companyId, month) {
    var _a, _b;
    const monthKey = (0, date_fns_1.format)(month, 'yyyy-MM');
    const startStr = (0, date_fns_1.startOfMonth)(month).toISOString();
    const endStr = (0, date_fns_1.endOfMonth)(month).toISOString();
    // 1. Buscar todos os agendamentos do mês
    const apptsSnap = await config_1.db
        .collection('companies')
        .doc(companyId)
        .collection('appointments')
        .where('schedules.start_time', '>=', startStr)
        .where('schedules.start_time', '<=', endStr)
        .get();
    // 2. Buscar registros financeiros do mês
    const finSnap = await config_1.db
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
    const clientsSnap = await config_1.db
        .collection('companies')
        .doc(companyId)
        .collection('clients')
        .get(); // removido where is_active=true para manter contabilidade passada correta
    for (const clientDoc of clientsSnap.docs) {
        const subsSnap = await config_1.db
            .collection('companies')
            .doc(companyId)
            .collection('clients')
            .doc(clientDoc.id)
            .collection('subscriptions')
            .get(); // removido status=active para testar vigência
        for (const subDoc of subsSnap.docs) {
            const sub = subDoc.data();
            // Validação de vigência da assinatura para o mês analisado
            const tStart = sub.start_date;
            const tEnd = sub.end_date || sub.cancelled_at;
            if (tStart && tStart > endStr)
                continue;
            if (tEnd && tEnd < startStr)
                continue;
            let subPrice = sub.amount || 0;
            // Fallback para assinaturas antigas sem snapshot
            if (!subPrice) {
                if (sub.subscription_plan_id) {
                    const planSnap = await config_1.db
                        .collection('companies')
                        .doc(companyId)
                        .collection('subscription_plans')
                        .doc(sub.subscription_plan_id)
                        .get();
                    subPrice = ((_a = planSnap.data()) === null || _a === void 0 ? void 0 : _a.price) || 0;
                }
                else if (sub.service_id) {
                    const svcSnap = await config_1.db
                        .collection('companies')
                        .doc(companyId)
                        .collection('services')
                        .doc(sub.service_id)
                        .get();
                    subPrice = ((_b = svcSnap.data()) === null || _b === void 0 ? void 0 : _b.price) || 0;
                }
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
    await (0, helpers_1.summaryRef)(companyId, monthKey).set({
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
exports.dailyReconciliation = (0, scheduler_1.onSchedule)({
    schedule: '0 3 * * *', // Cron: todo dia às 3h
    region: config_1.REGION,
    timeZone: 'America/Sao_Paulo',
}, async () => {
    const companiesSnap = await config_1.db.collection('companies').listDocuments();
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
//# sourceMappingURL=dailyReconciliation.js.map
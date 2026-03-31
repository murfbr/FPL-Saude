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
exports.onFinancialRecordWrite = exports.onAppointmentWrite = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const date_fns_1 = require("date-fns");
admin.initializeApp();
const db = admin.firestore();
const REGION = 'southamerica-east1';
// ─────────────────────────────────────────────────────────────────────────────
// Lógica de Recálculo do Sumário Mensal
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Recalcula o documento monthly_summaries/{companyId}/{YYYY-MM} do zero
 * lendo todos os appointments e financial_records do mês afetado.
 *
 * Estratégia: "Snapshot recalculation" — mais simples e à prova de inconsistências
 * do que incremento (que pode ficar fora de sincronia em cenários de retry).
 */
async function recalculateMonthlySummary(companyId, month) {
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
    // 3. Agregar appointments
    let totalRevenue = 0;
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
                byPartnership[partnershipId] = { name: '', clientIds: new Set(), sessionCount: 0 };
            }
        }
        if (a.status === 'completed') {
            completedAppointments++;
            totalRevenue += price;
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
    // 4. Agregar financial_records (assinaturas/pacotes)
    let subscriptionsRevenue = 0;
    let subscriptionsPaidCount = 0;
    finSnap.forEach((docSnap) => {
        const f = docSnap.data();
        const amount = f.amount || 0;
        // Registros vinculados a assinatura
        if (f.client_subscription_id) {
            subscriptionsRevenue += amount;
            subscriptionsPaidCount++;
        }
    });
    // 5. Serializar Sets para arrays (Firestore não suporta Set)
    const byPartnershipSerializer = {};
    for (const [id, data] of Object.entries(byPartnership)) {
        byPartnershipSerializer[id] = {
            name: data.name,
            clientCount: data.clientIds.size,
            sessionCount: data.sessionCount,
        };
    }
    // 6. Persistir o sumário
    const summaryRef = db
        .collection('companies')
        .doc(companyId)
        .collection('monthly_summaries')
        .doc(monthKey);
    await summaryRef.set({
        month: monthKey,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        // KPIs gerais
        total_revenue: totalRevenue,
        completed_appointments: completedAppointments,
        cancelled_appointments: cancelledAppointments,
        no_show_appointments: noShowAppointments,
        total_appointments: totalAppointments,
        // Financeiro (assinaturas)
        subscriptions_revenue_received: subscriptionsRevenue,
        subscriptions_paid_count: subscriptionsPaidCount,
        // Breakdowns
        by_professional: byProfessional,
        by_service: byService,
        by_partnership: byPartnershipSerializer,
    });
    console.log(`[summaries] Recalculated ${companyId}/${monthKey}: ${totalAppointments} appts, R$ ${totalRevenue}`);
}
// ─────────────────────────────────────────────────────────────────────────────
// Triggers
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Trigger: qualquer escrita em appointments
 * → Recalcula o sumário do mês do agendamento afetado
 */
exports.onAppointmentWrite = (0, firestore_1.onDocumentWritten)({
    document: 'companies/{companyId}/appointments/{appointmentId}',
    region: REGION,
}, async (event) => {
    var _a, _b, _c, _d, _e;
    const companyId = event.params.companyId;
    // Determinar o mês afetado (usar after ou before)
    const afterData = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after) === null || _b === void 0 ? void 0 : _b.data();
    const beforeData = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.before) === null || _d === void 0 ? void 0 : _d.data();
    const data = afterData || beforeData;
    if (!data)
        return;
    const startTime = (_e = data.schedules) === null || _e === void 0 ? void 0 : _e.start_time;
    if (!startTime)
        return;
    const month = new Date(startTime);
    if (isNaN(month.getTime()))
        return;
    await recalculateMonthlySummary(companyId, month);
});
/**
 * Trigger: qualquer escrita em financial_records
 * → Recalcula o sumário do mês do registro financeiro afetado
 */
exports.onFinancialRecordWrite = (0, firestore_1.onDocumentWritten)({
    document: 'companies/{companyId}/financial_records/{recordId}',
    region: REGION,
}, async (event) => {
    var _a, _b, _c, _d;
    const companyId = event.params.companyId;
    const afterData = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after) === null || _b === void 0 ? void 0 : _b.data();
    const beforeData = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.before) === null || _d === void 0 ? void 0 : _d.data();
    const data = afterData || beforeData;
    if (!data)
        return;
    const paymentDate = data.payment_date;
    if (!paymentDate)
        return;
    const month = new Date(paymentDate);
    if (isNaN(month.getTime()))
        return;
    await recalculateMonthlySummary(companyId, month);
});
//# sourceMappingURL=index.js.map
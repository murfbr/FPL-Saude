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
exports.fetchAllSubscriptionsByCompany = fetchAllSubscriptionsByCompany;
exports.fullRecalculation = fullRecalculation;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../config");
const helpers_1 = require("../shared/helpers");
const summaryCore_1 = require("../shared/summaryCore");
/**
 * Todas as assinaturas de todos os tenants em UMA query (Admin SDK ignora
 * rules). O client_id ausente em docs legados é derivado do path
 * (companies/{companyId}/clients/{clientId}/subscriptions/{id}).
 */
async function fetchAllSubscriptionsByCompany() {
    const snap = await config_1.db.collectionGroup('subscriptions').get();
    const byCompany = {};
    for (const docSnap of snap.docs) {
        const segments = docSnap.ref.path.split('/');
        // companies/{companyId}/clients/{clientId}/subscriptions/{id}
        if (segments[0] !== 'companies' || segments[2] !== 'clients')
            continue;
        const companyId = segments[1];
        const clientId = segments[3];
        const data = docSnap.data();
        if (!byCompany[companyId])
            byCompany[companyId] = [];
        byCompany[companyId].push(Object.assign(Object.assign({}, data), { client_id: data.client_id || clientId }));
    }
    return byCompany;
}
/**
 * Recalcula integralmente o sumário de um mês (verdade absoluta: sobrescreve
 * o documento). A semântica dos campos vem de summaryCore — a mesma dos
 * triggers incrementais.
 */
async function fullRecalculation(companyId, monthKey, companySubscriptions) {
    const { startIso, endIso } = (0, summaryCore_1.monthRangeUtc)(monthKey);
    const [apptsSnap, finSnap, partnershipsSnap] = await Promise.all([
        config_1.db
            .collection('companies')
            .doc(companyId)
            .collection('appointments')
            .where('schedules.start_time', '>=', startIso)
            .where('schedules.start_time', '<=', endIso)
            .get(),
        config_1.db
            .collection('companies')
            .doc(companyId)
            .collection('financial_records')
            .where('payment_date', '>=', startIso)
            .where('payment_date', '<=', endIso)
            .get(),
        config_1.db.collection('companies').doc(companyId).collection('partnerships').get(),
    ]);
    const partnershipNames = {};
    partnershipsSnap.forEach((d) => {
        partnershipNames[d.id] = d.data().name || '';
    });
    const summary = (0, summaryCore_1.buildMonthlySummary)({
        monthKey,
        appointments: apptsSnap.docs.map((d) => d.data()),
        financialRecords: finSnap.docs.map((d) => d.data()),
        subscriptionKeys: (0, summaryCore_1.subscriptionKeysForMonth)(companySubscriptions, monthKey),
        partnershipNames,
    });
    await (0, helpers_1.summaryRef)(companyId, monthKey).set(Object.assign(Object.assign({}, summary), { updated_at: admin.firestore.FieldValue.serverTimestamp(), last_full_recalc: admin.firestore.FieldValue.serverTimestamp() }));
    console.log(`[reconciliation] ${companyId}/${monthKey}: ${summary.total_appointments} appts, ` +
        `R$ ${summary.total_revenue.toFixed(2)} caixa, R$ ${summary.total_production_value.toFixed(2)} produção`);
}
exports.dailyReconciliation = (0, scheduler_1.onSchedule)({
    schedule: '0 3 * * *', // Cron: todo dia às 3h
    region: config_1.REGION,
    timeZone: 'America/Sao_Paulo',
}, async () => {
    const companiesSnap = await config_1.db.collection('companies').listDocuments();
    const subsByCompany = await fetchAllSubscriptionsByCompany();
    // Mês corrente + anterior: fecha a janela do último dia do mês (lançamentos
    // após as 3h) e corrige drift residual dos triggers em meses recém-fechados
    const current = (0, summaryCore_1.currentMonthKey)(new Date());
    const months = [current, (0, summaryCore_1.previousMonthKey)(current)];
    for (const companyRef of companiesSnap) {
        for (const monthKey of months) {
            try {
                await fullRecalculation(companyRef.id, monthKey, subsByCompany[companyRef.id] || []);
            }
            catch (err) {
                console.error(`[reconciliation] Erro em ${companyRef.id}/${monthKey}:`, err);
            }
        }
    }
    console.log(`[reconciliation] Concluída para ${companiesSnap.length} empresa(s) × ${months.length} mês(es)`);
});
//# sourceMappingURL=dailyReconciliation.js.map
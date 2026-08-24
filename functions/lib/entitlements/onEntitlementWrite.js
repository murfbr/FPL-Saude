"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onClientPackageWrite = exports.onClientSubscriptionWrite = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const config_1 = require("../config");
/**
 * Espelhos (índices) de assinaturas e pacotes dos pacientes em coleções
 * planas por empresa:
 *   companies/{id}/subscriptions_index/{subId}
 *   companies/{id}/client_packages_index/{pkgId}
 *
 * Motivo: as telas de cobrança (Gestão Financeira / Gestão de Pacotes) liam
 * clients × subcoleções (~1.000 reads por abertura). Com o índice, viram uma
 * query única. O espelho é mantido aqui — qualquer caminho de escrita
 * (telas, cascata de arquivamento, scripts) sincroniza automaticamente.
 * Somente as Functions escrevem nos índices (rules bloqueiam o client).
 */
async function clientSnapshotFields(companyId, clientId) {
    var _a, _b;
    const clientSnap = await config_1.db
        .collection('companies')
        .doc(companyId)
        .collection('clients')
        .doc(clientId)
        .get();
    return {
        client_name: ((_a = clientSnap.data()) === null || _a === void 0 ? void 0 : _a.name) || '',
        client_email: ((_b = clientSnap.data()) === null || _b === void 0 ? void 0 : _b.email) || '',
    };
}
exports.onClientSubscriptionWrite = (0, firestore_1.onDocumentWritten)({
    document: 'companies/{companyId}/clients/{clientId}/subscriptions/{subId}',
    region: config_1.REGION,
}, async (event) => {
    var _a, _b, _c, _d;
    const { companyId, clientId, subId } = event.params;
    const after = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after) === null || _b === void 0 ? void 0 : _b.data();
    const indexRef = config_1.db
        .collection('companies')
        .doc(companyId)
        .collection('subscriptions_index')
        .doc(subId);
    if (!after) {
        await indexRef.delete();
        return;
    }
    const client = await clientSnapshotFields(companyId, clientId);
    await indexRef.set(Object.assign(Object.assign({ id: subId, client_id: clientId }, client), { service_id: after.service_id || null, subscription_plan_id: after.subscription_plan_id || null, start_date: after.start_date || null, end_date: after.end_date || null, cancelled_at: after.cancelled_at || null, status: after.status || null, amount: (_c = after.amount) !== null && _c !== void 0 ? _c : null, discount_amount: (_d = after.discount_amount) !== null && _d !== void 0 ? _d : null, created_at: after.created_at || null, indexed_at: (0, config_1.ServerTs)() }));
});
exports.onClientPackageWrite = (0, firestore_1.onDocumentWritten)({
    document: 'companies/{companyId}/clients/{clientId}/packages/{pkgId}',
    region: config_1.REGION,
}, async (event) => {
    var _a, _b, _c, _d;
    const { companyId, clientId, pkgId } = event.params;
    const after = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after) === null || _b === void 0 ? void 0 : _b.data();
    const indexRef = config_1.db
        .collection('companies')
        .doc(companyId)
        .collection('client_packages_index')
        .doc(pkgId);
    if (!after) {
        await indexRef.delete();
        return;
    }
    const client = await clientSnapshotFields(companyId, clientId);
    await indexRef.set(Object.assign(Object.assign({ id: pkgId, client_id: clientId }, client), { package_id: after.package_id || null, purchase_date: after.purchase_date || null, sessions_remaining: (_c = after.sessions_remaining) !== null && _c !== void 0 ? _c : 0, discount_amount: (_d = after.discount_amount) !== null && _d !== void 0 ? _d : null, status: after.status || null, indexed_at: (0, config_1.ServerTs)() }));
});
//# sourceMappingURL=onEntitlementWrite.js.map
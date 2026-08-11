"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onAppointmentWrite = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const config_1 = require("../config");
const helpers_1 = require("../shared/helpers");
/**
 * Notificação "Aviso de Pacote" para os admins quando restarem 1–2 sessões.
 * Roda no servidor porque a lista de admins vive na coleção RAIZ `users`,
 * que o client não pode ler. ID determinístico do doc evita duplicatas em
 * redelivery do trigger.
 */
async function maybeNotifyPackageRunningLow(companyId, before, after) {
    var _a, _b;
    if (!(after === null || after === void 0 ? void 0 : after.client_package_id) || !(after === null || after === void 0 ? void 0 : after.client_id))
        return;
    const consuming = ['completed', 'no_show'];
    const isConsuming = consuming.includes(after.status);
    const wasConsuming = before ? consuming.includes(before.status) : false;
    if (!isConsuming || wasConsuming)
        return;
    // Cortesia não debita sessão — não gera aviso
    if (after.package_session_consumed === false)
        return;
    // O trigger roda após o commit: sessions_remaining já está decrementado
    const pkgSnap = await config_1.db
        .collection('companies').doc(companyId)
        .collection('clients').doc(after.client_id)
        .collection('packages').doc(after.client_package_id)
        .get();
    if (!pkgSnap.exists)
        return;
    const remaining = (_a = pkgSnap.data()) === null || _a === void 0 ? void 0 : _a.sessions_remaining;
    if (remaining !== 1 && remaining !== 2)
        return;
    const adminsSnap = await config_1.db
        .collection('users')
        .where('companyId', '==', companyId)
        .where('role', '==', 'admin')
        .get();
    if (adminsSnap.empty)
        return;
    const clientName = ((_b = after.clients) === null || _b === void 0 ? void 0 : _b.name) || 'um cliente';
    const createdAt = new Date().toISOString();
    const notifId = `pkg_${after.client_package_id}_${remaining}`;
    await Promise.all(adminsSnap.docs.map((adminDoc) => config_1.db
        .collection('companies').doc(companyId)
        .collection('admins').doc(adminDoc.id)
        .collection('notifications').doc(notifId)
        .set({
        id: notifId,
        professional_id: adminDoc.id,
        title: 'Aviso de Pacote',
        content: `Faltam ${remaining} sessões para o pacote de ${clientName} acabar.`,
        is_read: false,
        link: `/admin/pacientes/${after.client_id}`,
        created_at: createdAt,
    })));
}
exports.onAppointmentWrite = (0, firestore_1.onDocumentWritten)({
    document: 'companies/{companyId}/appointments/{appointmentId}',
    region: config_1.REGION,
}, async (event) => {
    var _a, _b, _c, _d, _e, _f;
    const companyId = event.params.companyId;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    try {
        await maybeNotifyPackageRunningLow(companyId, before, after);
    }
    catch (e) {
        console.error('Falha ao criar Aviso de Pacote', e);
    }
    const bMonth = ((_e = before === null || before === void 0 ? void 0 : before.schedules) === null || _e === void 0 ? void 0 : _e.start_time)
        ? (0, helpers_1.monthKeyOf)(before.schedules.start_time)
        : null;
    const aMonth = ((_f = after === null || after === void 0 ? void 0 : after.schedules) === null || _f === void 0 ? void 0 : _f.start_time)
        ? (0, helpers_1.monthKeyOf)(after.schedules.start_time)
        : null;
    if (!bMonth && !aMonth)
        return;
    // Caso comum: mesmo mês (criação, atualização de status, etc.)
    if (bMonth === aMonth && aMonth) {
        const delta = (0, helpers_1.appointmentDelta)(before, after);
        if (delta) {
            delta.month = aMonth;
            await (0, helpers_1.summaryRef)(companyId, aMonth).set(delta, { merge: true });
        }
        return;
    }
    // Cross-month: reagendamento entre meses ou criação/deleção
    const writes = [];
    if (bMonth) {
        // Remover do mês antigo (trata como deleção naquele mês)
        const removal = (0, helpers_1.appointmentDelta)(before, undefined);
        if (removal) {
            removal.month = bMonth;
            writes.push((0, helpers_1.summaryRef)(companyId, bMonth).set(removal, { merge: true }));
        }
    }
    if (aMonth) {
        // Adicionar no mês novo (trata como criação naquele mês)
        const addition = (0, helpers_1.appointmentDelta)(undefined, after);
        if (addition) {
            addition.month = aMonth;
            writes.push((0, helpers_1.summaryRef)(companyId, aMonth).set(addition, { merge: true }));
        }
    }
    await Promise.all(writes);
});
//# sourceMappingURL=onAppointmentWrite.js.map
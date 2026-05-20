"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onAppointmentWrite = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const config_1 = require("../config");
const helpers_1 = require("../shared/helpers");
exports.onAppointmentWrite = (0, firestore_1.onDocumentWritten)({
    document: 'companies/{companyId}/appointments/{appointmentId}',
    region: config_1.REGION,
}, async (event) => {
    var _a, _b, _c, _d, _e, _f;
    const companyId = event.params.companyId;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
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
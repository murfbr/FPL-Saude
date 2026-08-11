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
exports.onUserWrite = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const config_1 = require("../config");
const admin = __importStar(require("firebase-admin"));
exports.onUserWrite = (0, firestore_1.onDocumentWritten)({
    document: 'users/{uid}',
    region: config_1.REGION,
}, async (event) => {
    var _a, _b;
    const uid = event.params.uid;
    const after = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after) === null || _b === void 0 ? void 0 : _b.data();
    // O ciclo de vida do acesso (congelar/reativar conta) é responsabilidade da
    // callable setStaffActive — este trigger NÃO deleta mais contas de Auth nem
    // anonimiza o cadastro do profissional. Histórico é sempre preservado.
    if (!after)
        return;
    const { companyId, role } = after;
    if (!companyId || !role) {
        console.log(`User ${uid} is missing companyId or role. Skipping custom claims.`);
        return;
    }
    try {
        const userRecord = await admin.auth().getUser(uid);
        const currentClaims = userRecord.customClaims || {};
        if (currentClaims.companyId === companyId && currentClaims.role === role) {
            console.log(`User ${uid} already has the correct claims. Skipping.`);
            return;
        }
        await admin.auth().setCustomUserClaims(uid, Object.assign(Object.assign({}, currentClaims), { companyId,
            role }));
        console.log(`Successfully set claims for user ${uid}: companyId=${companyId}, role=${role}`);
    }
    catch (error) {
        console.error(`Error setting custom claims for user ${uid}:`, error);
    }
});
//# sourceMappingURL=onUserWrite.js.map
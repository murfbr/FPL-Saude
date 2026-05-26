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
    var _a, _b, _c, _d;
    const uid = event.params.uid;
    const after = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after) === null || _b === void 0 ? void 0 : _b.data();
    const before = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.before) === null || _d === void 0 ? void 0 : _d.data();
    const isSoftDeleted = after && after.is_active === false && before && before.is_active !== false;
    const isHardDeleted = !after && before;
    if (isSoftDeleted || isHardDeleted) {
        // Document deleted (hard or soft), we must delete the Auth user and clean up subcollections
        const userRef = isSoftDeleted ? after : before;
        const { companyId, role, name } = userRef;
        try {
            await admin.auth().deleteUser(uid);
            console.log(`Successfully deleted auth user ${uid}`);
            if (companyId && (role === 'professional' || role === 'admin')) {
                await admin.firestore()
                    .collection('companies')
                    .doc(companyId)
                    .collection('professionals')
                    .doc(uid)
                    .set({
                    is_active: false,
                    name: name ? `${name} (Excluído)` : 'Usuário Excluído',
                    email: '',
                    avatar_url: ''
                }, { merge: true });
                console.log(`Cleaned up professional doc for ${uid}`);
            }
        }
        catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log(`Auth user ${uid} already deleted or not found.`);
            }
            else {
                console.error(`Error deleting auth user ${uid}:`, error);
            }
        }
        return;
    }
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
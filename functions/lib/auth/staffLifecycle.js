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
exports.setStaffActive = exports.createStaffUser = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../config");
/** Caller precisa ser admin da empresa-alvo ou super-admin ativo. */
async function assertCompanyAdmin(auth, companyId) {
    var _a, _b, _c;
    if (!(auth === null || auth === void 0 ? void 0 : auth.uid)) {
        throw new https_1.HttpsError('unauthenticated', 'Faça login para executar esta ação.');
    }
    const sa = await config_1.db.collection('super_admins').doc(auth.uid).get();
    if (sa.exists && ((_a = sa.data()) === null || _a === void 0 ? void 0 : _a.is_active) === true)
        return;
    let role = auth.token.role;
    let userCompany = auth.token.companyId;
    if (!role || !userCompany) {
        const userSnap = await config_1.db.collection('users').doc(auth.uid).get();
        role = role || ((_b = userSnap.data()) === null || _b === void 0 ? void 0 : _b.role);
        userCompany = userCompany || ((_c = userSnap.data()) === null || _c === void 0 ? void 0 : _c.companyId);
    }
    if (role !== 'admin' || userCompany !== companyId) {
        throw new https_1.HttpsError('permission-denied', 'Apenas admins da empresa podem executar esta ação.');
    }
}
/**
 * Cria uma conta de staff (Auth + users raiz + professionals) atomicamente.
 * Se qualquer passo falhar, a conta de Auth é desfeita — nenhuma conta órfã
 * nem e-mail preso fica para trás. Claims são setadas na hora (sem esperar
 * o trigger onUserWrite).
 */
exports.createStaffUser = (0, https_1.onCall)({ region: config_1.REGION }, async (request) => {
    const { companyId, name, email, password, role, specialty, bio, avatarUrl } = (request.data || {});
    if (!companyId || !name || !email) {
        throw new https_1.HttpsError('invalid-argument', 'companyId, name e email são obrigatórios.');
    }
    const staffRole = role === 'admin' || role === 'client' ? role : 'professional';
    await assertCompanyAdmin(request.auth, companyId);
    const finalPassword = password || Math.random().toString(36).slice(-10) + 'A1!';
    let uid;
    try {
        const userRecord = await admin.auth().createUser({
            email,
            password: finalPassword,
            displayName: name,
        });
        uid = userRecord.uid;
    }
    catch (e) {
        const code = e === null || e === void 0 ? void 0 : e.code;
        if (code === 'auth/email-already-exists') {
            throw new https_1.HttpsError('already-exists', 'Este e-mail já está em uso por outra conta.');
        }
        if (code === 'auth/invalid-email') {
            throw new https_1.HttpsError('invalid-argument', 'E-mail inválido.');
        }
        console.error('createStaffUser: falha no Auth', e);
        throw new https_1.HttpsError('internal', 'Falha ao criar a conta de acesso.');
    }
    try {
        // Claims imediatas — o usuário já loga com o RBAC correto
        await admin.auth().setCustomUserClaims(uid, { companyId, role: staffRole });
        const nowISO = new Date().toISOString();
        const batch = config_1.db.batch();
        batch.set(config_1.db.collection('users').doc(uid), {
            name,
            email,
            role: staffRole,
            companyId,
            created_at: nowISO,
        });
        const profData = {
            id: uid,
            user_id: uid,
            name,
            email,
            specialty: specialty || '',
            bio: bio || '',
            avatar_url: avatarUrl || '',
            is_active: true,
            service_ids: [],
            created_at: nowISO,
        };
        if (staffRole !== 'client') {
            batch.set(config_1.db.collection('companies').doc(companyId).collection('professionals').doc(uid), profData);
        }
        await batch.commit();
        return { professional: staffRole !== 'client' ? profData : null };
    }
    catch (e) {
        // Rollback: desfaz a conta de Auth para não deixar órfã/e-mail preso
        try {
            await admin.auth().deleteUser(uid);
        }
        catch (rollbackErr) {
            console.error('createStaffUser: rollback do Auth falhou', rollbackErr);
        }
        console.error('createStaffUser: falha ao gravar perfis', e);
        throw new https_1.HttpsError('internal', 'Falha ao criar o cadastro. Nenhuma conta foi criada.');
    }
});
/**
 * Ativa/desativa o ACESSO de um profissional. Desativar congela a conta
 * (disabled) e revoga as sessões abertas — nada é apagado, nenhum histórico
 * muda; reativar religa a mesma conta com a mesma senha. Retorna a contagem
 * de agendamentos futuros para a UI avisar o admin (não cancela nada).
 */
exports.setStaffActive = (0, https_1.onCall)({ region: config_1.REGION }, async (request) => {
    var _a, _b, _c;
    const { companyId, professionalId, userId, active } = (request.data || {});
    if (!companyId || typeof active !== 'boolean' || (!professionalId && !userId)) {
        throw new https_1.HttpsError('invalid-argument', 'companyId, active e (professionalId ou userId) são obrigatórios.');
    }
    await assertCompanyAdmin(request.auth, companyId);
    // Resolve alvo: pelo cadastro de profissional OU direto pelo usuário raiz
    let targetUserId;
    let profDocId;
    if (professionalId) {
        const profSnap = await config_1.db
            .collection('companies').doc(companyId)
            .collection('professionals').doc(professionalId)
            .get();
        if (!profSnap.exists) {
            throw new https_1.HttpsError('not-found', 'Profissional não encontrado.');
        }
        profDocId = professionalId;
        targetUserId = (_a = profSnap.data()) === null || _a === void 0 ? void 0 : _a.user_id;
    }
    else if (userId) {
        const userSnap = await config_1.db.collection('users').doc(userId).get();
        if (!userSnap.exists || ((_b = userSnap.data()) === null || _b === void 0 ? void 0 : _b.companyId) !== companyId) {
            throw new https_1.HttpsError('not-found', 'Usuário não encontrado nesta empresa.');
        }
        targetUserId = userId;
        // Cadastro de profissional correspondente, se existir (id == uid nos fluxos atuais)
        const profSnap = await config_1.db
            .collection('companies').doc(companyId)
            .collection('professionals').doc(userId)
            .get();
        if (profSnap.exists)
            profDocId = userId;
    }
    if (targetUserId && targetUserId === ((_c = request.auth) === null || _c === void 0 ? void 0 : _c.uid)) {
        throw new https_1.HttpsError('failed-precondition', 'Você não pode desativar a própria conta.');
    }
    // 1. Congela/religa a conta de acesso, se houver login vinculado
    if (targetUserId) {
        try {
            await admin.auth().updateUser(targetUserId, { disabled: !active });
            if (!active) {
                await admin.auth().revokeRefreshTokens(targetUserId);
            }
        }
        catch (e) {
            if ((e === null || e === void 0 ? void 0 : e.code) !== 'auth/user-not-found') {
                console.error('setStaffActive: falha ao atualizar Auth', e);
                throw new https_1.HttpsError('internal', 'Falha ao atualizar a conta de acesso.');
            }
        }
        // 2. Estado no perfil raiz (se existir)
        const userRef = config_1.db.collection('users').doc(targetUserId);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
            await userRef.set({ is_active: active }, { merge: true });
        }
    }
    // 3. Marca no cadastro do profissional (some de novos agendamentos)
    if (profDocId) {
        await config_1.db
            .collection('companies').doc(companyId)
            .collection('professionals').doc(profDocId)
            .set({ is_active: active }, { merge: true });
    }
    // 4. Informativo: agendamentos futuros ainda marcados (decisão de cancelar é humana)
    let futureAppointments = null;
    if (profDocId) {
        try {
            const snap = await config_1.db
                .collection('companies').doc(companyId)
                .collection('appointments')
                .where('professional_id', '==', profDocId)
                .where('schedules.start_time', '>=', new Date().toISOString())
                .get();
            futureAppointments = snap.docs.filter((d) => d.data().status === 'scheduled').length;
        }
        catch (e) {
            console.error('setStaffActive: contagem de agendamentos futuros falhou', e);
        }
    }
    return { active, futureAppointments };
});
//# sourceMappingURL=staffLifecycle.js.map
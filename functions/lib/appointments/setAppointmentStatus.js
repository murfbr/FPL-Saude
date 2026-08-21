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
exports.setAppointmentStatus = void 0;
const https_1 = require("firebase-functions/v2/https");
const config_1 = require("../config");
const admin = __importStar(require("firebase-admin"));
const summaryCore_1 = require("../shared/summaryCore");
const VALID_STATUSES = [
    'scheduled',
    'confirmed',
    'completed',
    'cancelled',
    'no_show',
];
/** Resolve papel/empresa do chamador (claims com fallback no doc raiz). */
async function resolveCaller(auth) {
    var _a, _b;
    if (!(auth === null || auth === void 0 ? void 0 : auth.uid)) {
        throw new https_1.HttpsError('unauthenticated', 'Faça login para executar esta ação.');
    }
    let role = auth.token.role;
    let companyId = auth.token.companyId;
    if (!role || !companyId) {
        const userSnap = await config_1.db.collection('users').doc(auth.uid).get();
        role = role || ((_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.role);
        companyId = companyId || ((_b = userSnap.data()) === null || _b === void 0 ? void 0 : _b.companyId);
    }
    if (!role || !companyId || role === 'client') {
        throw new https_1.HttpsError('permission-denied', 'Você não tem permissão para alterar agendamentos.');
    }
    return { uid: auth.uid, role, companyId };
}
/** Profissional só altera o próprio agendamento, salvo feature update_all_statuses. */
async function assertCanChangeAppointment(caller, appt) {
    var _a, _b, _c, _d;
    if (caller.role === 'admin')
        return;
    const profId = appt.professional_id;
    if (profId) {
        if (profId === caller.uid)
            return;
        const profSnap = await config_1.db
            .collection('companies')
            .doc(caller.companyId)
            .collection('professionals')
            .doc(profId)
            .get();
        if (profSnap.exists && ((_a = profSnap.data()) === null || _a === void 0 ? void 0 : _a.user_id) === caller.uid)
            return;
    }
    const companySnap = await config_1.db
        .collection('companies')
        .doc(caller.companyId)
        .get();
    const features = ((_d = (_c = (_b = companySnap.data()) === null || _b === void 0 ? void 0 : _b.roles) === null || _c === void 0 ? void 0 : _c[caller.role]) === null || _d === void 0 ? void 0 : _d.features) || [];
    if (features.includes('update_all_statuses'))
        return;
    throw new https_1.HttpsError('permission-denied', 'Você só pode atualizar o status dos seus próprios atendimentos.');
}
/** Assinatura ativa do cliente para o serviço (mesma regra do client). */
async function hasActiveSubscription(companyId, clientId, serviceId) {
    const snap = await config_1.db
        .collection('companies')
        .doc(companyId)
        .collection('clients')
        .doc(clientId)
        .collection('subscriptions')
        .where('service_id', '==', serviceId)
        .get();
    return snap.docs.some((d) => {
        const s = d.data();
        return !s.status || s.status === 'active';
    });
}
/**
 * Muda o status de um agendamento com os efeitos financeiros em TRANSAÇÃO:
 * débito/estorno de sessão de pacote, criação/remoção do registro financeiro
 * (ID determinístico appt_<id> — corrida de dois cliques é inócua) e gravação
 * do billing_type que os agregados usam. Roda com Admin SDK: o client não
 * escreve mais financial_records ao concluir, e as rules podem exigir admin.
 */
exports.setAppointmentStatus = (0, https_1.onCall)({ region: config_1.REGION }, async (request) => {
    var _a;
    const { appointmentId, status, allowExhaustedPackageUse } = (request.data ||
        {});
    if (!appointmentId || !status || !VALID_STATUSES.includes(status)) {
        throw new https_1.HttpsError('invalid-argument', 'appointmentId e status válido são obrigatórios.');
    }
    const caller = await resolveCaller(request.auth);
    const companyRef = config_1.db.collection('companies').doc(caller.companyId);
    const apptRef = companyRef.collection('appointments').doc(appointmentId);
    const finCol = companyRef.collection('financial_records');
    const preSnap = await apptRef.get();
    if (!preSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Agendamento não encontrado.');
    }
    const preData = preSnap.data();
    await assertCanChangeAppointment(caller, preData);
    // Registros legados deste atendimento (IDs aleatórios de antes do ID
    // determinístico) — coletados fora da transação para poderem ser deletados
    const legacySnap = await finCol
        .where('appointment_id', '==', appointmentId)
        .get();
    const legacyRefs = legacySnap.docs.map((d) => d.ref);
    const deterministicFinRef = finCol.doc(`appt_${appointmentId}`);
    const isEvent = preData.entry_type === 'event';
    // Classificação fora da transação (leitura de subcoleção): a janela de
    // corrida aqui só afeta o rótulo billing_type, corrigido pelo cron
    let billing = 'independent';
    if (!isEvent) {
        billing = (0, summaryCore_1.classifyAppointment)(preData);
        if (billing === 'independent' &&
            preData.client_id &&
            preData.service_id &&
            !preData.billing_type) {
            if (await hasActiveSubscription(caller.companyId, preData.client_id, preData.service_id)) {
                billing = 'subscription';
            }
        }
    }
    let notifyMissingNote = false;
    await config_1.db.runTransaction(async (tx) => {
        var _a, _b;
        const apptSnap = await tx.get(apptRef);
        if (!apptSnap.exists) {
            throw new https_1.HttpsError('not-found', 'Agendamento não encontrado.');
        }
        const appt = apptSnap.data();
        const oldStatus = appt.status;
        if (oldStatus === status)
            return;
        const amount = (0, summaryCore_1.effectivePrice)(appt);
        // ── Eventos flexíveis: só o registro financeiro ─────────────────────
        if (isEvent) {
            if (status === 'completed' && oldStatus !== 'completed') {
                if (amount > 0 && legacyRefs.length === 0) {
                    tx.set(deterministicFinRef, {
                        id: deterministicFinRef.id,
                        client_id: null,
                        professional_id: appt.professional_id || null,
                        appointment_id: appointmentId,
                        amount,
                        payment_date: new Date().toISOString(),
                        description: `Evento — ${appt.event_title || 'Sem título'}`,
                        payment_method: 'manual',
                        created_at: new Date().toISOString(),
                        created_by: caller.uid,
                    });
                }
            }
            else if (oldStatus === 'completed' && status !== 'completed') {
                for (const ref of legacyRefs)
                    tx.delete(ref);
                tx.delete(deterministicFinRef);
            }
            tx.update(apptRef, { status });
            return;
        }
        // ── Pacote: consumir/devolver sessão dentro da transação ────────────
        const isPackage = billing === 'package' && !!appt.client_package_id;
        let packageSessionConsumed;
        if (isPackage && appt.client_id) {
            const packageRef = companyRef
                .collection('clients')
                .doc(appt.client_id)
                .collection('packages')
                .doc(appt.client_package_id);
            const isConsuming = status === 'completed' || status === 'no_show';
            const wasConsuming = oldStatus === 'completed' || oldStatus === 'no_show';
            if (isConsuming && !wasConsuming) {
                const pkgSnap = await tx.get(packageRef);
                if (!pkgSnap.exists) {
                    packageSessionConsumed = false;
                }
                else {
                    const pkg = pkgSnap.data();
                    const pkgUnavailable = pkg.status === 'cancelled' ||
                        pkg.status === 'terminated' ||
                        (pkg.sessions_remaining || 0) <= 0;
                    if (pkgUnavailable && !allowExhaustedPackageUse) {
                        throw new https_1.HttpsError('failed-precondition', 'Pacote esgotado ou cancelado. Confirme a cortesia para concluir sem debitar sessão.', { code: 'PACKAGE_UNAVAILABLE' });
                    }
                    if (pkgUnavailable) {
                        packageSessionConsumed = false;
                    }
                    else {
                        tx.update(packageRef, {
                            sessions_remaining: admin.firestore.FieldValue.increment(-1),
                        });
                        packageSessionConsumed = true;
                    }
                }
            }
            else if (wasConsuming && !isConsuming) {
                if (appt.package_session_consumed !== false) {
                    tx.update(packageRef, {
                        sessions_remaining: admin.firestore.FieldValue.increment(1),
                    });
                }
            }
        }
        // ── Registro financeiro da sessão avulsa ────────────────────────────
        if (billing === 'independent' &&
            status === 'completed' &&
            oldStatus !== 'completed') {
            if (amount > 0 && legacyRefs.length === 0) {
                tx.set(deterministicFinRef, {
                    id: deterministicFinRef.id,
                    client_id: appt.client_id || null,
                    professional_id: appt.professional_id || null,
                    appointment_id: appointmentId,
                    amount,
                    payment_date: new Date().toISOString(),
                    description: `Sessão Avulsa - ${((_a = appt.services) === null || _a === void 0 ? void 0 : _a.name) || 'Serviço'}`,
                    payment_method: 'manual',
                    created_at: new Date().toISOString(),
                    created_by: caller.uid,
                });
            }
        }
        else if (oldStatus === 'completed' && status !== 'completed') {
            // Remove por existência, independente da classificação atual — ela pode
            // ter mudado desde a conclusão (ex.: assinatura cancelada depois)
            for (const ref of legacyRefs)
                tx.delete(ref);
            tx.delete(deterministicFinRef);
        }
        const apptUpdate = {
            status,
            billing_type: billing,
        };
        if (packageSessionConsumed !== undefined) {
            apptUpdate.package_session_consumed = packageSessionConsumed;
        }
        tx.update(apptRef, apptUpdate);
        if (status === 'completed' && oldStatus !== 'completed') {
            const requiresObs = (_b = appt.services) === null || _b === void 0 ? void 0 : _b.requires_observation;
            const hasNotes = Array.isArray(appt.notes) && appt.notes.length > 0;
            notifyMissingNote = !!requiresObs && !hasNotes;
        }
    });
    // Notificação "Prontuário Pendente" — fora da transação (best-effort)
    if (notifyMissingNote && preData.professional_id) {
        try {
            const notifRef = companyRef
                .collection('professionals')
                .doc(preData.professional_id)
                .collection('notifications')
                .doc(`missing_note_${appointmentId}`);
            await notifRef.set({
                id: notifRef.id,
                professional_id: preData.professional_id,
                title: 'Prontuário Pendente',
                content: `O atendimento de ${((_a = preData.clients) === null || _a === void 0 ? void 0 : _a.name) || 'um cliente'} foi concluído. Por favor, adicione a evolução/observação.`,
                is_read: false,
                link: null,
                created_at: new Date().toISOString(),
            });
        }
        catch (e) {
            console.error('Falha ao criar notificação de prontuário pendente', e);
        }
    }
    return { ok: true };
});
//# sourceMappingURL=setAppointmentStatus.js.map
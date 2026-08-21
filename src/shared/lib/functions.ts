import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from './firebase'

// Mesma região das Cloud Functions (functions/src/config.ts)
export const functions = getFunctions(app, 'southamerica-east1')

/** Cria conta de staff no servidor (Auth + perfis) com rollback atômico. */
export const callCreateStaffUser = httpsCallable(functions, 'createStaffUser')

/** Ativa/desativa o acesso de um profissional/usuário (congela a conta, nunca apaga). */
export const callSetStaffActive = httpsCallable(functions, 'setStaffActive')

/**
 * Muda status de agendamento no servidor (transação): débito/estorno de
 * pacote, registro financeiro e billing_type — sem depender de permissão de
 * leitura/escrita de financial_records no client.
 */
export const callSetAppointmentStatus = httpsCallable(
  functions,
  'setAppointmentStatus',
)

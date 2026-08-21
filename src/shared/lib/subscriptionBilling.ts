/**
 * Regras de cobrança de assinatura — fonte única.
 *
 * Toda data de assinatura (start_date, end_date, cancelled_at) é tratada como
 * DATA DE CALENDÁRIO: só o trecho 'YYYY-MM-DD' da ISO conta. Isso elimina a
 * classe de bugs em que '2026-08-15T00:00:00.000Z' lido com getters locais
 * (UTC-3) vira 14/08 — que cobrava 1 dia a mais de pro-rata e fazia
 * assinatura iniciada no dia 1 aparecer vigente no mês anterior.
 */
import { ClientSubscription } from '@/shared/types'

/** 'YYYY-MM-DD' do campo, ignorando hora e fuso. */
export function dateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null
  const s = iso.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function monthKeyFromDate(ref: Date): string {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`
}

function daysInMonth(ref: Date): number {
  return new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate()
}

/**
 * Valor-base mensal da assinatura.
 * Cascata: amount negociado (já com desconto, gravado na criação) →
 * preço de tabela (plano ou serviço) MENOS discount_amount cadastrado.
 * O segundo ramo cobre assinaturas do onboarding, que gravam apenas o
 * desconto de parceria sem consolidar o amount.
 */
export function subscriptionBaseAmount(sub: ClientSubscription): number {
  if (typeof sub.amount === 'number' && sub.amount > 0) return sub.amount
  const listPrice = sub.subscription_plans?.price || sub.services?.price || 0
  const discount = sub.discount_amount || 0
  return Math.max(0, listPrice - discount)
}

/**
 * Pro-rata do primeiro mês: se a assinatura começa dentro do mês de
 * referência, cobra os dias do início (inclusive) até o fim do mês.
 * Retorna null quando o mês de referência não é o mês de início.
 */
export function prorationForMonth(
  sub: ClientSubscription,
  ref: Date,
): { daysActive: number; daysInMonth: number } | null {
  const start = dateOnly(sub.start_date)
  if (!start) return null
  if (start.slice(0, 7) !== monthKeyFromDate(ref)) return null

  const startDay = Number(start.slice(8, 10))
  const total = daysInMonth(ref)
  return { daysActive: total - startDay + 1, daysInMonth: total }
}

/**
 * Valor a cobrar da assinatura no mês de referência (com pro-rata quando o
 * mês é o de início). Usado pela cobrança E pela exibição — nunca duplicar.
 */
export function subscriptionChargeForMonth(
  sub: ClientSubscription,
  ref: Date,
): {
  amount: number
  proration: { daysActive: number; daysInMonth: number } | null
} {
  const base = subscriptionBaseAmount(sub)
  const proration = prorationForMonth(sub, ref)
  if (!proration) return { amount: base, proration: null }
  const amount =
    Math.round((base / proration.daysInMonth) * proration.daysActive * 100) /
    100
  return { amount, proration }
}

/**
 * Vigência no mês de referência, por data de calendário:
 * começou até o último dia do mês E terminou (end_date/cancelled_at) depois
 * do primeiro dia. Sem data de fim e status não-ativo = dado sujo, não conta.
 */
export function subscriptionCoversMonth(
  sub: ClientSubscription,
  ref: Date,
): boolean {
  const monthKey = monthKeyFromDate(ref)
  const firstDay = `${monthKey}-01`
  const lastDay = `${monthKey}-${String(daysInMonth(ref)).padStart(2, '0')}`

  const start = dateOnly(sub.start_date)
  const end = dateOnly(sub.end_date || sub.cancelled_at)

  if (start && start > lastDay) return false
  if (end && end < firstDay) return false
  if (!end && sub.status && sub.status !== 'active') return false
  return true
}

/** A assinatura terminou dentro ou antes do mês de referência? */
export function subscriptionEndedByMonth(
  sub: ClientSubscription,
  ref: Date,
): boolean {
  const monthKey = monthKeyFromDate(ref)
  const lastDay = `${monthKey}-${String(daysInMonth(ref)).padStart(2, '0')}`
  const end = dateOnly(sub.end_date || sub.cancelled_at)
  return !!end && end <= lastDay
}

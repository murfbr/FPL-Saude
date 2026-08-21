import { describe, test, expect } from 'vitest'
import {
  dateOnly,
  subscriptionBaseAmount,
  subscriptionChargeForMonth,
  subscriptionCoversMonth,
  subscriptionEndedByMonth,
} from '../src/shared/lib/subscriptionBilling'
import { ClientSubscription } from '../src/shared/types'

const makeSub = (over: Partial<ClientSubscription>): ClientSubscription =>
  ({
    id: 'sub1',
    client_id: 'cli1',
    service_id: 'svc1',
    start_date: '2026-08-15T00:00:00.000Z',
    end_date: null,
    status: 'active',
    created_at: '',
    updated_at: '',
    ...over,
  }) as ClientSubscription

describe('dateOnly', () => {
  test('extrai a data de calendário sem sofrer com fuso', () => {
    expect(dateOnly('2026-08-15T00:00:00.000Z')).toBe('2026-08-15')
    expect(dateOnly(null)).toBeNull()
    expect(dateOnly('inválida')).toBeNull()
  })
})

describe('subscriptionBaseAmount — cascata com desconto', () => {
  test('amount negociado prevalece', () => {
    const sub = makeSub({ amount: 250, services: { price: 300 } as any, discount_amount: 50 })
    expect(subscriptionBaseAmount(sub)).toBe(250)
  })

  test('sem amount, aplica discount_amount sobre o preço de tabela (caso do onboarding com parceria)', () => {
    const sub = makeSub({ services: { price: 300 } as any, discount_amount: 45 })
    expect(subscriptionBaseAmount(sub)).toBe(255)
  })

  test('plano prevalece sobre serviço e desconto nunca negativa', () => {
    const sub = makeSub({
      subscription_plans: { price: 400 } as any,
      services: { price: 300 } as any,
      discount_amount: 999,
    })
    expect(subscriptionBaseAmount(sub)).toBe(0)
  })
})

describe('pro-rata por data de calendário (fim do off-by-one)', () => {
  test('início dia 15/08 cobra 17/31 dias — não 18/31', () => {
    // O bug original: new Date('...T00:00:00Z').getDate() no browser UTC-3
    // lia dia 14 e cobrava 18 dias. R$310 → R$180 em vez de R$170.
    const sub = makeSub({ amount: 310, start_date: '2026-08-15T00:00:00.000Z' })
    const { amount, proration } = subscriptionChargeForMonth(sub, new Date(2026, 7, 20))
    expect(proration).toEqual({ daysActive: 17, daysInMonth: 31 })
    expect(amount).toBe(170)
  })

  test('fora do mês de início cobra o valor cheio', () => {
    const sub = makeSub({ amount: 310, start_date: '2026-08-15T00:00:00.000Z' })
    const { amount, proration } = subscriptionChargeForMonth(sub, new Date(2026, 8, 10))
    expect(proration).toBeNull()
    expect(amount).toBe(310)
  })

  test('início no dia 1 cobra mês cheio (pro-rata de 31/31)', () => {
    const sub = makeSub({ amount: 310, start_date: '2026-08-01T00:00:00.000Z' })
    const { amount } = subscriptionChargeForMonth(sub, new Date(2026, 7, 5))
    expect(amount).toBe(310)
  })
})

describe('vigência por mês de calendário', () => {
  test('assinatura do dia 1 não aparece no mês anterior (fim da falsa pendência)', () => {
    const sub = makeSub({ start_date: '2026-08-01T00:00:00.000Z' })
    expect(subscriptionCoversMonth(sub, new Date(2026, 6, 15))).toBe(false)
    expect(subscriptionCoversMonth(sub, new Date(2026, 7, 15))).toBe(true)
  })

  test('cancelada dentro do mês: vige no mês, encerrada a partir dele', () => {
    const sub = makeSub({
      start_date: '2026-05-01T00:00:00.000Z',
      status: 'cancelled',
      cancelled_at: '2026-08-12T18:00:00.000Z',
    })
    expect(subscriptionCoversMonth(sub, new Date(2026, 7, 1))).toBe(true)
    expect(subscriptionCoversMonth(sub, new Date(2026, 8, 1))).toBe(false)
    expect(subscriptionEndedByMonth(sub, new Date(2026, 7, 1))).toBe(true)
    expect(subscriptionEndedByMonth(sub, new Date(2026, 6, 1))).toBe(false)
  })
})

import { describe, test, expect } from 'vitest'
import {
  monthKeyOf,
  dayKeyOf,
  monthRangeUtc,
  previousMonthKey,
  lastDayOfMonth,
  classifyAppointment,
  effectivePrice,
  subscriptionCoversMonth,
  subscriptionKeysForMonth,
  buildMonthlySummary,
} from '../functions/src/shared/summaryCore'
import {
  dayKeyOf as clientDayKeyOf,
  SP_UTC_OFFSET_MS as clientOffset,
} from '../src/shared/lib/spTime'
import { SP_UTC_OFFSET_MS as serverOffset } from '../functions/src/shared/summaryCore'

describe('bucketing de datas em America/Sao_Paulo', () => {
  test('21h30 de Brasília do último dia do mês pertence ao mês local, não ao UTC', () => {
    // 31/08 21:30 BRT = 01/09 00:30 UTC — o bug original jogava para setembro
    expect(monthKeyOf('2026-09-01T00:30:00.000Z')).toBe('2026-08')
    expect(dayKeyOf('2026-09-01T00:30:00.000Z')).toBe('2026-08-31')
  })

  test('horários fora da borda ficam no próprio mês', () => {
    expect(monthKeyOf('2026-08-15T12:00:00.000Z')).toBe('2026-08')
    expect(monthKeyOf('2026-09-01T03:00:00.000Z')).toBe('2026-09')
  })

  test('data inválida retorna null', () => {
    expect(monthKeyOf('não-é-data')).toBeNull()
    expect(dayKeyOf('')).toBeNull()
  })

  test('janela UTC do mês cobre exatamente o mês-calendário de São Paulo', () => {
    const { startIso, endIso } = monthRangeUtc('2026-08')
    expect(startIso).toBe('2026-08-01T03:00:00.000Z')
    expect(endIso).toBe('2026-09-01T02:59:59.999Z')
    // O instante da borda cai dentro da janela e no mês certo
    expect('2026-09-01T00:30:00.000Z' <= endIso).toBe(true)
  })

  test('mês anterior, inclusive virada de ano', () => {
    expect(previousMonthKey('2026-08')).toBe('2026-07')
    expect(previousMonthKey('2026-01')).toBe('2025-12')
  })

  test('último dia do mês, inclusive fevereiro bissexto', () => {
    expect(lastDayOfMonth('2026-08')).toBe('2026-08-31')
    expect(lastDayOfMonth('2028-02')).toBe('2028-02-29')
  })

  test('paridade client/servidor: spTime espelha summaryCore', () => {
    expect(clientOffset).toBe(serverOffset)
    const samples = [
      '2026-09-01T00:30:00.000Z',
      '2026-08-15T12:00:00.000Z',
      '2026-12-31T23:59:59.000Z',
    ]
    for (const iso of samples) {
      expect(clientDayKeyOf(iso)).toBe(dayKeyOf(iso))
    }
  })
})

describe('classificação e preço efetivo', () => {
  test('billing_type gravado na conclusão tem prioridade sobre heurística', () => {
    expect(
      classifyAppointment({ billing_type: 'subscription', client_package_id: 'pkg1' }),
    ).toBe('subscription')
  })

  test('heurística: pacote > serviço mensal > assinatura vigente > avulsa', () => {
    expect(classifyAppointment({ client_package_id: 'pkg1' })).toBe('package')
    expect(classifyAppointment({ services: { value_type: 'monthly' } })).toBe('subscription')
    const keys = new Set(['cli1_svc1'])
    expect(
      classifyAppointment({ client_id: 'cli1', service_id: 'svc1' }, keys),
    ).toBe('subscription')
    expect(classifyAppointment({ client_id: 'cli2', service_id: 'svc1' }, keys)).toBe('independent')
  })

  test('evento flexível é independente e usa event_price', () => {
    const event = { entry_type: 'event', event_price: 350, services: { price: 999 } }
    expect(classifyAppointment(event)).toBe('independent')
    expect(effectivePrice(event)).toBe(350)
  })

  test('preço efetivo aplica desconto e nunca fica negativo', () => {
    expect(effectivePrice({ services: { price: 100 }, discount_amount: 20 })).toBe(80)
    expect(effectivePrice({ services: { price: 100 }, discount_amount: 150 })).toBe(0)
  })
})

describe('vigência de assinatura por data de calendário', () => {
  test('assinatura iniciada no dia 1 NÃO vige no mês anterior', () => {
    const sub = { start_date: '2026-08-01T00:00:00.000Z', end_date: null, status: 'active' }
    expect(subscriptionCoversMonth(sub, '2026-07')).toBe(false)
    expect(subscriptionCoversMonth(sub, '2026-08')).toBe(true)
  })

  test('cancelada dentro do mês ainda vige naquele mês', () => {
    const sub = {
      start_date: '2026-05-10T00:00:00.000Z',
      end_date: null,
      cancelled_at: '2026-08-12T14:00:00.000Z',
      status: 'cancelled',
    }
    expect(subscriptionCoversMonth(sub, '2026-08')).toBe(true)
    expect(subscriptionCoversMonth(sub, '2026-09')).toBe(false)
  })

  test('dado sujo (sem fim, status não-ativo) não conta como vigente', () => {
    const sub = { start_date: '2026-01-01T00:00:00.000Z', end_date: null, status: 'paused' }
    expect(subscriptionCoversMonth(sub, '2026-08')).toBe(false)
  })

  test('subscriptionKeysForMonth só inclui vigentes — cliente com assinatura antiga cancelada não reclassifica sessão avulsa', () => {
    const subs = [
      { client_id: 'c1', service_id: 's1', start_date: '2026-01-01', cancelled_at: '2026-03-01', status: 'cancelled' },
      { client_id: 'c2', service_id: 's1', start_date: '2026-01-01', end_date: null, status: 'active' },
    ]
    const keys = subscriptionKeysForMonth(subs, '2026-08')
    expect(keys.has('c1_s1')).toBe(false)
    expect(keys.has('c2_s1')).toBe(true)
  })
})

describe('buildMonthlySummary — semântica caixa × produção', () => {
  const base = {
    professional_id: 'prof1',
    service_id: 'svc1',
    client_id: 'cli1',
    status: 'completed',
    professionals: { name: 'Ana' },
    services: { name: 'Fisio', price: 100 },
    schedules: { start_time: '2026-08-10T13:00:00.000Z' },
  }

  test('sessão de pacote gera produção, não caixa; avulsa gera os dois', () => {
    const summary = buildMonthlySummary({
      monthKey: '2026-08',
      appointments: [
        { ...base, billing_type: 'package' },
        { ...base, billing_type: 'independent', discount_amount: 20 },
      ],
      financialRecords: [
        { amount: 80, professional_id: 'prof1', payment_date: '2026-08-10T15:00:00.000Z' },
      ],
      subscriptionKeys: new Set(),
    })

    const prof = summary.by_professional['prof1']
    expect(prof.production_value).toBe(180) // 100 (pacote) + 80 (avulsa com desconto)
    expect(prof.revenue).toBe(80) // só a avulsa
    expect(prof.package_sessions).toBe(1)
    expect(prof.independent_sessions).toBe(1)
    expect(prof.independent_revenue).toBe(80) // do financial_record real
    expect(summary.total_revenue).toBe(80)
    expect(summary.total_production_value).toBe(180)
    expect(summary.by_service['svc1'].revenue).toBe(80)
    expect(summary.by_service['svc1'].production_value).toBe(180)
  })

  test('parceria mantém revenue, production_value e nome (o cron antigo apagava)', () => {
    const summary = buildMonthlySummary({
      monthKey: '2026-08',
      appointments: [{ ...base, partnership_id: 'part1', billing_type: 'independent' }],
      financialRecords: [],
      subscriptionKeys: new Set(),
      partnershipNames: { part1: 'Clube Atlético' },
    })
    const part = summary.by_partnership['part1']
    expect(part.name).toBe('Clube Atlético')
    expect(part.revenue).toBe(100)
    expect(part.production_value).toBe(100)
    expect(part.sessionCount).toBe(1)
    expect(part.clientCount).toBe(1)
    expect(summary.by_professional_partnership['prof1_part1'].production_value).toBe(100)
  })

  test('cancelamento e falta contam nos contadores, nunca em valor', () => {
    const summary = buildMonthlySummary({
      monthKey: '2026-08',
      appointments: [
        { ...base, status: 'cancelled' },
        { ...base, status: 'no_show', billing_type: 'package' },
      ],
      financialRecords: [],
      subscriptionKeys: new Set(),
    })
    expect(summary.cancelled_appointments).toBe(1)
    expect(summary.no_show_appointments).toBe(1)
    expect(summary.total_production_value).toBe(0)
    expect(summary.by_professional['prof1'].revenue).toBe(0)
  })

  test('pagamentos de assinatura alimentam subscriptions_revenue_received', () => {
    const summary = buildMonthlySummary({
      monthKey: '2026-08',
      appointments: [],
      financialRecords: [
        { amount: 300, client_subscription_id: 'sub1', professional_id: 'admin1' },
        { amount: 500, client_package_id: 'pkg1', professional_id: 'admin1' },
      ],
      subscriptionKeys: new Set(),
    })
    expect(summary.total_revenue).toBe(800)
    expect(summary.subscriptions_revenue_received).toBe(300)
    expect(summary.subscriptions_paid_count).toBe(1)
    // Pagamento de pacote/assinatura não é caixa avulso de ninguém
    expect(summary.by_professional['admin1']).toBeUndefined()
  })
})

import { test, expect } from 'vitest'
import { findActiveSubscriptionForService } from '../src/modules/clients/services/subscriptions'
import type { ClientSubscription } from '../src/shared/types'

const sub = (overrides: Partial<ClientSubscription>): ClientSubscription =>
  ({
    id: 'id',
    client_id: 'c1',
    service_id: 'pilates',
    start_date: '2026-01-01T00:00:00.000Z',
    end_date: null,
    status: 'active',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as ClientSubscription

test('ignora assinatura cancelada mesmo vindo primeiro na lista', () => {
  const cancelled = sub({ id: 'old', status: 'cancelled' })
  const active = sub({ id: 'new', status: 'active' })
  expect(findActiveSubscriptionForService([cancelled, active], 'pilates')?.id).toBe('new')
})

test('retorna null quando só há canceladas para o serviço', () => {
  const cancelled = sub({ status: 'cancelled' })
  expect(findActiveSubscriptionForService([cancelled], 'pilates')).toBeNull()
})

test('status ausente conta como ativa (docs legados)', () => {
  const legacy = sub({ id: 'legacy', status: undefined as unknown as ClientSubscription['status'] })
  expect(findActiveSubscriptionForService([legacy], 'pilates')?.id).toBe('legacy')
})

test('não retorna assinatura de outro serviço', () => {
  const other = sub({ service_id: 'rpg' })
  expect(findActiveSubscriptionForService([other], 'pilates')).toBeNull()
})

test('havendo mais de uma ativa, vale a criada mais recentemente', () => {
  const older = sub({ id: 'older', created_at: '2026-01-01T00:00:00.000Z' })
  const newer = sub({ id: 'newer', created_at: '2026-08-01T00:00:00.000Z' })
  expect(findActiveSubscriptionForService([older, newer], 'pilates')?.id).toBe('newer')
})

test('lida com lista nula ou vazia', () => {
  expect(findActiveSubscriptionForService(null, 'pilates')).toBeNull()
  expect(findActiveSubscriptionForService([], 'pilates')).toBeNull()
})

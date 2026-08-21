/**
 * Bucketing de dia/mês no fuso de São Paulo — espelho client-side de
 * functions/src/shared/summaryCore.ts (a paridade é garantida por
 * tests/summary-core.test.ts, que importa os dois lados).
 *
 * America/Sao_Paulo é UTC-3 fixo desde a abolição do horário de verão (2019).
 */
export const SP_UTC_OFFSET_MS = 3 * 60 * 60 * 1000

/** 'YYYY-MM-DD' do instante ISO no fuso de São Paulo (null se inválido). */
export function dayKeyOf(iso: string): string | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return new Date(t - SP_UTC_OFFSET_MS).toISOString().slice(0, 10)
}

/** Instante UTC em que o dia de calendário 'YYYY-MM-DD' começa em São Paulo. */
export function spDayStartUtc(day: string): string {
  return `${day}T03:00:00.000Z`
}

/** Instante UTC em que o dia de calendário 'YYYY-MM-DD' termina em São Paulo. */
export function spDayEndUtc(day: string): string {
  const next = new Date(
    Date.parse(`${day}T00:00:00.000Z`) + 24 * 60 * 60 * 1000,
  )
  return `${next.toISOString().slice(0, 10)}T02:59:59.999Z`
}

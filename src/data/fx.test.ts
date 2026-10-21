import { describe, expect, it } from 'vitest'
import { CURRENCIES, FX_URL, isCurrencyCode, isIsoDate, parseFxResponse, sanitizeRates } from './fx'

const good = { amount: 1, base: 'USD', date: '2026-10-21', rates: { EUR: 0.89015, SEK: 9.8785, GBP: 0.75, XAU: 0.0003 } }

describe('fx constants', () => {
  it('uses the Frankfurter USD endpoint and the curated list in order', () => {
    expect(FX_URL).toBe('https://api.frankfurter.dev/v1/latest?base=USD')
    expect(CURRENCIES).toEqual(['USD', 'EUR', 'SEK', 'GBP', 'NOK', 'DKK', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'INR'])
  })

  it('recognises curated codes only', () => {
    expect(isCurrencyCode('SEK')).toBe(true)
    expect(isCurrencyCode('sek')).toBe(false)
    expect(isCurrencyCode('BTC')).toBe(false)
    expect(isCurrencyCode(undefined)).toBe(false)
  })

  it('recognises ISO dates', () => {
    expect(isIsoDate('2026-10-21')).toBe(true)
    expect(isIsoDate('21/10/2026')).toBe(false)
    expect(isIsoDate(20261021)).toBe(false)
  })
})

describe('parseFxResponse', () => {
  it('accepts a good response and keeps only curated codes (never USD)', () => {
    expect(parseFxResponse(good)).toEqual({ date: '2026-10-21', rates: { EUR: 0.89015, SEK: 9.8785, GBP: 0.75 } })
    expect(parseFxResponse({ ...good, rates: { ...good.rates, USD: 1 } })?.rates).not.toHaveProperty('USD')
  })

  it.each([
    ['not an object', 'nope'],
    ['null', null],
    ['an array', []],
    ['wrong base', { ...good, base: 'EUR' }],
    ['missing base', { date: good.date, rates: good.rates }],
    ['missing date', { base: 'USD', rates: good.rates }],
    ['bad date', { ...good, date: 'yesterday' }],
    ['missing rates', { base: 'USD', date: good.date }],
    ['rates not an object', { ...good, rates: [1, 2] }],
    ['negative rate', { ...good, rates: { EUR: -0.9 } }],
    ['zero rate', { ...good, rates: { EUR: 0 } }],
    ['NaN rate', { ...good, rates: { EUR: NaN } }],
    ['Infinity rate', { ...good, rates: { EUR: Infinity } }],
    ['string rate', { ...good, rates: { EUR: '0.9' } }],
    ['a bad non-curated rate', { ...good, rates: { EUR: 0.9, XAU: -1 } }],
    ['no curated code at all', { ...good, rates: { XAU: 0.0003 } }],
  ])('rejects %s', (_name, input) => {
    expect(parseFxResponse(input)).toBeNull()
  })
})

describe('sanitizeRates', () => {
  it('rejects non-objects', () => {
    expect(sanitizeRates(undefined)).toBeNull()
    expect(sanitizeRates(5)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { everyOtherTickLabel, fmtPrice, fmtTokens, fmtUsd, formatMoney, signedMoney, truncateLabel } from './format'

describe('fmtTokens', () => {
  it('formats raw, K and M', () => {
    expect(fmtTokens(999)).toBe('999')
    expect(fmtTokens(20000)).toBe('20K')
    expect(fmtTokens(922000)).toBe('922K')
    expect(fmtTokens(1e6)).toBe('1M')
    expect(fmtTokens(1050000)).toBe('1.05M')
  })
})

describe('fmtUsd', () => {
  it('formats by magnitude', () => {
    expect(fmtUsd(0)).toBe('$0')
    expect(fmtUsd(0.078)).toBe('$0.078')
    expect(fmtUsd(0.00123)).toBe('$0.0012')
    expect(fmtUsd(33.06)).toBe('$33.06')
    expect(fmtUsd(1)).toBe('$1.00')
    expect(fmtUsd(123.4)).toBe('$123')
  })
})

describe('fmtPrice', () => {
  it('trims trailing zeros up to 4 decimals', () => {
    expect(fmtPrice(4)).toBe('$4')
    expect(fmtPrice(0.75)).toBe('$0.75')
    expect(fmtPrice(0.025 * 10)).toBe('$0.25')
    expect(fmtPrice(0.123456)).toBe('$0.1235')
  })
})

describe('formatMoney', () => {
  it('USD output is identical to fmtUsd', () => {
    expect(formatMoney(33.06)).toBe('$33.06')
    expect(formatMoney(0.078, 'USD', 1)).toBe('$0.078')
    expect(formatMoney(0, 'USD', 1)).toBe('$0')
    expect(formatMoney(100, 'USD', 1)).toBe('$100')
    for (const v of [0, 0.00123, 0.078, 0.5, 1, 1.005, 9.995, 33.06, 99.995, 100, 123.4, 1234.56, 40000.5]) {
      expect(formatMoney(v, 'USD', 1)).toBe(fmtUsd(v))
    }
    expect(fmtUsd(1234.56)).toBe('$1235')
  })

  it('converts and keeps the magnitude rules for EUR and SEK', () => {
    expect(formatMoney(33.06, 'EUR', 0.89)).toBe('€29.42')
    expect(formatMoney(5.5, 'EUR', 0.89)).toBe('€4.90')
    expect(formatMoney(33.06, 'SEK', 9.8785).replace(/\s/g, ' ')).toBe('SEK 327')
    expect(formatMoney(5.5, 'SEK', 9.8785).replace(/\s/g, ' ')).toBe('SEK 54.33')
  })

  it('keeps two significant digits below 1 and prints 0 for zero', () => {
    expect(formatMoney(0.078, 'EUR', 0.89)).toBe('€0.069')
    expect(formatMoney(0.00123, 'GBP', 0.75)).toBe('£0.00092')
    expect(formatMoney(0, 'EUR', 0.89)).toBe('€0')
  })

  it('zero-decimal currencies (JPY) never get forced decimals', () => {
    expect(formatMoney(33.06, 'JPY', 150)).toBe('¥4959')
    expect(formatMoney(0.5, 'JPY', 150)).toBe('¥75')
    expect(formatMoney(0.02, 'JPY', 150)).toBe('¥3')
    expect(formatMoney(0.001, 'JPY', 150)).toBe('¥0.15')
    expect(formatMoney(0, 'JPY', 150)).toBe('¥0')
  })

  it('never shows NaN: a bad rate falls back to USD, a non-finite value is a dash', () => {
    for (const rate of [0, -1, NaN, Infinity]) expect(formatMoney(33.06, 'SEK', rate)).toBe('$33.06')
    expect(formatMoney(NaN, 'EUR', 0.89)).toBe('—')
    expect(formatMoney(Infinity)).toBe('—')
  })

  it('shows an unknown currency code bare, and negatives with a leading minus', () => {
    expect(formatMoney(2, 'XXXX', 1)).toBe('XXXX 2.00')
    expect(formatMoney(-5, 'USD', 1)).toBe('-$5.00')
  })
})

describe('signedMoney', () => {
  it('uses a real minus sign, a plus sign, and plain zero', () => {
    expect(signedMoney(13.63, fmtUsd)).toBe('+$13.63')
    expect(signedMoney(-13.63, fmtUsd)).toBe('−$13.63')
    expect(signedMoney(0, fmtUsd)).toBe('$0')
    expect(signedMoney(1e-12, fmtUsd)).toBe('$0')
    expect(signedMoney(-5, (v) => formatMoney(v, 'EUR', 0.9))).toBe('−€4.50')
  })
})

describe('everyOtherTickLabel', () => {
  it('labels even indexes, starting with the first tick', () => {
    expect(everyOtherTickLabel(0, 0, fmtUsd)).toBe('$0')
    expect(everyOtherTickLabel(20, 2, fmtUsd)).toBe('$20.00')
    expect(everyOtherTickLabel(40, 4, fmtUsd)).toBe('$40.00')
  })

  it('returns an empty string, not null, for odd indexes so the gridline stays', () => {
    for (const i of [1, 3, 5, 7]) expect(everyOtherTickLabel(i * 10, i, fmtUsd)).toBe('')
  })

  it('uses the given formatter (the display currency)', () => {
    const sek = (v: number) => formatMoney(v, 'SEK', 10)
    expect(everyOtherTickLabel(2, 2, sek).replace(/\s/g, ' ')).toBe('SEK 20.00')
    expect(everyOtherTickLabel(2, 3, sek)).toBe('')
  })
})

describe('truncateLabel', () => {
  it('keeps short text and cuts long text to the limit with an ellipsis, by code point', () => {
    expect(truncateLabel('Fast cache', 14)).toBe('Fast cache')
    expect(truncateLabel('x'.repeat(14), 14)).toBe('x'.repeat(14))
    expect(truncateLabel('x'.repeat(15), 14)).toBe(`${'x'.repeat(13)}\u2026`)
    expect(truncateLabel('\u{1F680}'.repeat(20), 14)).toBe(`${'\u{1F680}'.repeat(13)}\u2026`)
  })
})

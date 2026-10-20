import { describe, expect, it } from 'vitest'
import { fmtPrice, fmtTokens, fmtUsd } from './format'

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

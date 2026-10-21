import { describe, expect, it } from 'vitest'
import { DEFAULT_SHARED } from '../data/defaults'
import { PROTOTYPE_SETUPS } from './prototype-fixtures'
import { fmtTokens, fmtUsd } from '../format'
import { compare } from './compare'
import { simulate } from './simulate'
import type { Run } from './types'

const run = (cums: number[], end = 100): Run => ({
  points: cums.map((cum, i) => ({ x: (i + 1) * 10, cum, req: 0, paused: false, miss: false })),
  totals: { requests: cums.length, read: 0, write: 0, rewrite: 0, output: 0, total: cums.at(-1) ?? 0 },
  end,
})

describe('compare: parity with the prototype defaults', () => {
  it('compares at 920K: A $30.18, B $60.64, A is 50% cheaper', () => {
    const c = compare(simulate(PROTOTYPE_SETUPS.A, DEFAULT_SHARED), simulate(PROTOTYPE_SETUPS.B, DEFAULT_SHARED))
    expect(c.common).toBe(920000)
    expect(fmtTokens(c.common)).toBe('920K')
    expect(c.a.toFixed(2)).toBe('30.18')
    expect(c.b.toFixed(2)).toBe('60.64')
    expect(fmtUsd(c.a)).toBe('$30.18')
    expect(fmtUsd(c.b)).toBe('$60.64')
    expect(c.cheaper).toBe('A')
    expect(c.percent).toBe(50)
    expect(c.capped).toBe(true)
  })
})

describe('compare: edge cases', () => {
  it('reports B cheaper when B costs less', () => {
    const c = compare(run([4, 8]), run([1, 2]))
    expect(c).toMatchObject({ common: 20, a: 8, b: 2, cheaper: 'B', percent: 75, capped: false })
  })

  it('reports a tie', () => {
    expect(compare(run([1, 2]), run([1, 2])).cheaper).toBeNull()
  })

  it('uses the cumulative cost at the last point not past the common size', () => {
    const c = compare(run([1, 2, 3, 4]), run([5, 6]))
    expect(c).toMatchObject({ common: 20, a: 2, b: 6 })
  })

  it('handles an empty run', () => {
    const c = compare(run([]), run([1, 2]))
    expect(c).toMatchObject({ common: 0, a: 0, b: 0, cheaper: null })
  })
})

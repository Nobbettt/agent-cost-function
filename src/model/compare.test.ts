import { describe, expect, it } from 'vitest'
import { DEFAULT_SETUPS, DEFAULT_SHARED } from '../data/defaults'
import { fmtTokens, fmtUsd } from '../format'
import { compare, type RunEntry } from './compare'
import { PROTOTYPE_SETUPS } from './prototype-fixtures'
import { simulate } from './simulate'
import type { Run, SetupId } from './types'

const run = (cums: number[], end = 100): Run => ({
  points: cums.map((cum, i) => ({ x: (i + 1) * 10, cum, req: 0, miss: false })),
  totals: { requests: cums.length, read: 0, write: 0, rewrite: 0, output: 0, total: cums.at(-1) ?? 0 },
  end,
})
const entries = (spec: [SetupId, number[], number?][]): RunEntry[] => spec.map(([id, cums, end]) => ({ id, run: run(cums, end) }))
const valueOf = (c: ReturnType<typeof compare>, id: SetupId) => c.values.find((v) => v.id === id)?.value

describe('compare: parity with the prototype defaults (two runs)', () => {
  it('compares at 920K: A $30.18, B $60.64, A is 50% cheaper', () => {
    const c = compare([
      { id: 'A', run: simulate(PROTOTYPE_SETUPS.A, DEFAULT_SHARED) },
      { id: 'B', run: simulate(PROTOTYPE_SETUPS.B, DEFAULT_SHARED) },
    ])
    expect(c.common).toBe(920000)
    expect(fmtTokens(c.common)).toBe('920K')
    expect(valueOf(c, 'A')!.toFixed(2)).toBe('30.18')
    expect(valueOf(c, 'B')!.toFixed(2)).toBe('60.64')
    expect(fmtUsd(valueOf(c, 'A')!)).toBe('$30.18')
    expect(fmtUsd(valueOf(c, 'B')!)).toBe('$60.64')
    expect(c.cheapest).toBe('A')
    expect(c.mostExpensive).toBe('B')
    expect(c.percent).toBe(50)
    expect(c.capped).toBe(true)
  })

  it('the new defaults: A (5m cache) is 24% cheaper than B (1h cache), neither capped', () => {
    const c = compare([
      { id: 'A', run: simulate(DEFAULT_SETUPS.A, DEFAULT_SHARED) },
      { id: 'B', run: simulate(DEFAULT_SETUPS.B, DEFAULT_SHARED) },
    ])
    expect(c).toMatchObject({ common: 995000, cheapest: 'A', mostExpensive: 'B', percent: 24, capped: false })
    expect(c.saving.toFixed(2)).toBe('13.37')
  })
})

describe('compare: two runs', () => {
  it('reports B cheaper when B costs less', () => {
    const c = compare(entries([['A', [4, 8]], ['B', [1, 2]]]))
    expect(c).toMatchObject({ common: 20, cheapest: 'B', mostExpensive: 'A', saving: 6, percent: 75, capped: false })
    expect(c.values).toEqual([{ id: 'A', value: 8 }, { id: 'B', value: 2 }])
  })

  it('reports a tie as no cheapest', () => {
    const c = compare(entries([['A', [1, 2]], ['B', [1, 2]]]))
    expect(c).toMatchObject({ cheapest: null, mostExpensive: null, saving: 0, percent: 0 })
  })

  it('uses the cumulative cost at the last point not past the common size', () => {
    const c = compare(entries([['A', [1, 2, 3, 4]], ['B', [5, 6]]]))
    expect(c).toMatchObject({ common: 20 })
    expect([valueOf(c, 'A'), valueOf(c, 'B')]).toEqual([2, 6])
  })

  it('handles an empty run', () => {
    const c = compare(entries([['A', []], ['B', [1, 2]]]))
    expect(c).toMatchObject({ common: 0, cheapest: null })
    expect(c.values.map((v) => v.value)).toEqual([0, 0])
  })

  it('handles no runs at all', () => {
    expect(compare([])).toMatchObject({ common: 0, values: [], cheapest: null, capped: false })
  })
})

describe('compare: three and four runs', () => {
  it('finds the cheapest and the most expensive of three', () => {
    const c = compare(entries([['A', [5, 10]], ['B', [2, 4]], ['C', [3, 8]]]))
    expect(c).toMatchObject({ cheapest: 'B', mostExpensive: 'A', saving: 6, percent: 60 })
  })

  it('compares at the shortest run of four', () => {
    const c = compare(entries([['A', [1, 2, 3, 4]], ['B', [2, 4, 6]], ['C', [1, 1, 1, 1, 1]], ['D', [9, 9]]], ))
    expect(c.common).toBe(20)
    expect(c.values.map((v) => v.value)).toEqual([2, 4, 1, 9])
    expect(c).toMatchObject({ cheapest: 'C', mostExpensive: 'D', saving: 8 })
    expect(c.percent).toBe(89)
  })

  it('keeps each setup\'s id: C stays C when B is absent', () => {
    const c = compare(entries([['A', [3, 6]], ['C', [1, 2]]]))
    expect(c.values.map((v) => v.id)).toEqual(['A', 'C'])
    expect(c.cheapest).toBe('C')
  })

  it('all four equal is a tie', () => {
    const c = compare(entries([['A', [2]], ['B', [2]], ['C', [2]], ['D', [2]]]))
    expect(c).toMatchObject({ cheapest: null, mostExpensive: null, saving: 0 })
  })

  it('a tie for lowest picks the first of them; a tie for highest too', () => {
    const c = compare(entries([['A', [1]], ['B', [1]], ['C', [5]], ['D', [5]]]))
    expect(c).toMatchObject({ cheapest: 'A', mostExpensive: 'C', saving: 4, percent: 80 })
  })

  it('is capped when any run ends before the others, even if the rest tie', () => {
    expect(compare(entries([['A', [1], 100], ['B', [2], 100], ['C', [3], 92]])).capped).toBe(true)
    expect(compare(entries([['A', [1], 100], ['B', [2], 100], ['C', [3], 100]])).capped).toBe(false)
  })

  it('does not mutate its input', () => {
    const e = Object.freeze(entries([['A', [1, 2]], ['B', [3, 4]]]))
    expect(() => compare(e)).not.toThrow()
  })
})

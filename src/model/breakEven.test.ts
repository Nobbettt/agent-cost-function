import { describe, expect, it } from 'vitest'
import { DEFAULT_SETUPS, DEFAULT_SHARED } from '../data/defaults'
import { avgBreakCost, boundary, breakEven, breakEvenGrid, cheaperAt, chartRange, costCurve, costsAt, gridRows, longRange, type CurvePoint } from './breakEven'
import { switchModel } from './normalize'
import { simulate } from './simulate'

const base = DEFAULT_SETUPS.A
const curve = costCurve(base, DEFAULT_SHARED, 12)
const pt = (k: number, cost5: number, cost1h: number): CurvePoint => ({ k, cost5, cost1h })

describe('costCurve', () => {
  it('has one point for each k from 0 to maxK', () => {
    expect(curve.map((p) => p.k)).toEqual(Array.from({ length: 13 }, (_, k) => k))
    expect(costCurve(base, DEFAULT_SHARED, 0)).toHaveLength(1)
  })

  it('reuses simulate: 5 min at k breaks, 1 hour with none', () => {
    expect(curve[0].cost5).toBeCloseTo(simulate({ ...base, cache: '5m', interruptions: 0 }, DEFAULT_SHARED).totals.total, 9)
    expect(curve[7].cost5).toBeCloseTo(simulate({ ...base, cache: '5m', interruptions: 7 }, DEFAULT_SHARED).totals.total, 9)
    expect(curve[0].cost1h).toBeCloseTo(simulate({ ...base, cache: '1h', interruptions: 0 }, DEFAULT_SHARED).totals.total, 9)
  })

  it('ignores the cache and interruptions of the setup it is given', () => {
    const other = costCurve({ ...base, cache: '1h', interruptions: 9 }, DEFAULT_SHARED, 12)
    expect(other).toEqual(curve)
  })

  it('rises with every interruption on the 5 min cache and is constant on the 1 hour cache', () => {
    for (let k = 1; k < curve.length; k++) expect(curve[k].cost5).toBeGreaterThan(curve[k - 1].cost5)
    expect(new Set(curve.map((p) => p.cost1h)).size).toBe(1)
  })

  it('starts at the default Opus 5.5 numbers: $25.93 on the 5 min cache, $28.92 on the 1 hour cache', () => {
    expect(curve[0].cost5.toFixed(2)).toBe('25.93')
    expect(curve[0].cost1h.toFixed(2)).toBe('28.92')
  })
})

describe('breakEven', () => {
  it('for the defaults: the 1 hour cache pays off at about 1.26 interruptions, from 2 on', () => {
    const r = breakEven(curve)
    expect(r.exact).toBeCloseTo(1.2587, 3)
    expect(r.firstK).toBe(2)
    expect(curve[1].cost5).toBeLessThan(curve[1].cost1h)
    expect(curve[2].cost5).toBeGreaterThan(curve[2].cost1h)
  })

  it('interpolates linearly between the two integer counts that straddle the crossing', () => {
    // difference cost5 - cost1h: -3 at k=1, +1 at k=2: the crossing is 3/4 of the way.
    expect(breakEven([pt(0, 5, 10), pt(1, 7, 10), pt(2, 11, 10), pt(3, 15, 10)])).toEqual({ exact: 1.75, firstK: 2 })
    // exactly equal at k=1, then more: the crossing is at k=1, the first count above is 2.
    expect(breakEven([pt(0, 8, 10), pt(1, 10, 10), pt(2, 12, 10)])).toEqual({ exact: 1, firstK: 2 })
  })

  it('is 0 and 0 when the 1 hour cache is already cheaper with no interruptions', () => {
    expect(breakEven([pt(0, 12, 10), pt(1, 14, 10)])).toEqual({ exact: 0, firstK: 0 })
  })

  it('is null and null when there is no crossing within the curve', () => {
    expect(breakEven([pt(0, 5, 10), pt(1, 6, 10), pt(2, 7, 10)])).toEqual({ exact: null, firstK: null })
    expect(breakEven([])).toEqual({ exact: null, firstK: null })
    expect(breakEven(costCurve(base, { ...DEFAULT_SHARED, session: 10000 }, 6))).toEqual({ exact: null, firstK: null })
  })

  it('moves with the model: Haiku (long-prompt tier) and Fable on a short session cross at other places', () => {
    const haiku = breakEven(costCurve(switchModel(base, 'claude-haiku-5-5'), DEFAULT_SHARED, 12))
    const fable = breakEven(costCurve(switchModel(base, 'claude-fable-5-1'), { ...DEFAULT_SHARED, session: 200000 }, 12))
    expect(haiku.exact).toBeCloseTo(1.2137, 3)
    expect(fable.exact).toBeCloseTo(1.2678, 3)
    expect([haiku.firstK, fable.firstK]).toEqual([2, 2])
  })
})

describe('avgBreakCost', () => {
  it('for the defaults: an interruption adds about $2.38 on the 5 min cache', () => {
    expect(avgBreakCost(curve)).toBeCloseTo(2.382, 3)
    expect(avgBreakCost(curve)).toBeCloseTo((curve[12].cost5 - curve[0].cost5) / 12, 12)
  })

  it('is (cost5(maxK) - cost5(0)) / maxK for any curve, and 0 for a single point or none', () => {
    expect(avgBreakCost([pt(0, 5, 0), pt(1, 6, 0), pt(2, 9, 0), pt(4, 13, 0)])).toBe(2)
    expect(avgBreakCost([pt(0, 5, 0)])).toBe(0)
    expect(avgBreakCost([])).toBe(0)
  })
})

describe('costCurve on a date', () => {
  it('prices the same curve at the prices in force on that date', () => {
    const argon = { ...DEFAULT_SETUPS.A, provider: 'google' as const, model: 'gemini-4-argon', cache: 'implicit' as const }
    const before = costCurve(argon, DEFAULT_SHARED, 2, 0, '2026-11-30')
    const after = costCurve(argon, DEFAULT_SHARED, 2, 0, '2026-12-01')
    expect(after[0].cost5).toBeCloseTo(before[0].cost5 * 2, 9)
    // Claude models have no schedule: the date changes nothing.
    expect(costCurve(DEFAULT_SETUPS.A, DEFAULT_SHARED, 3, 0, '2031-01-01')).toEqual(costCurve(DEFAULT_SETUPS.A, DEFAULT_SHARED, 3))
  })
})

describe('costCurve with pauses over an hour', () => {
  const at = (long: number, maxK = 12) => costCurve(base, DEFAULT_SHARED, maxK, long)

  it('with none it is the old curve: 1.2587, from 2, $25.93 and $28.92', () => {
    expect(at(0)).toEqual(curve)
    expect(breakEven(at(0))).toEqual({ exact: expect.closeTo(1.2587, 3), firstK: 2 })
  })

  it('cost5 breaks on every pause: k short plus the long ones', () => {
    for (const long of [1, 3]) {
      const c = at(long, 4)
      for (const k of [0, 2, 4]) {
        expect(c[k].cost5).toBeCloseTo(simulate({ ...base, cache: '5m', interruptions: k + long }, DEFAULT_SHARED).totals.total, 9)
      }
    }
    // The same total for 1 + 1 as for 2 + 0: only the count of breaks matters for the 5 minute cache.
    expect(at(1, 3)[1].cost5).toBeCloseTo(at(0, 3)[2].cost5, 9)
  })

  it('cost1h depends only on the long pauses, and pays 2x for their re-writes', () => {
    for (const long of [0, 1, 2, 3]) {
      const c = at(long, 5)
      expect(new Set(c.map((p) => p.cost1h)).size).toBe(1)
      expect(c[0].cost1h).toBeCloseTo(simulate({ ...base, cache: '1h', interruptions: long }, DEFAULT_SHARED).totals.total, 9)
    }
    expect(at(0)[0].cost1h.toFixed(2)).toBe('28.92')
    expect(at(1)[0].cost1h.toFixed(2)).toBe('32.76')
    expect(at(2)[0].cost1h.toFixed(2)).toBe('36.66')
    expect(at(3)[0].cost1h.toFixed(2)).toBe('40.50')
  })

  it('each longer pause moves the break-even up: 1.26, 1.87, 2.51, 3.12 (from 2, 2, 3, 4)', () => {
    const results = [0, 1, 2, 3].map((long) => breakEven(at(long)))
    expect(results.map((r) => +r.exact!.toFixed(4))).toEqual([1.2587, 1.8725, 2.5144, 3.1186])
    expect(results.map((r) => r.firstK)).toEqual([2, 2, 3, 4])
    for (let i = 1; i < results.length; i++) expect(results[i].exact!).toBeGreaterThan(results[i - 1].exact!)
  })

  it('the 5 minute cache can start dearer or cheaper: with 2 longer pauses it is cheaper at k = 0', () => {
    expect(at(2)[0].cost5).toBeLessThan(at(2)[0].cost1h)
  })

  it('passes the date through to the prices', () => {
    const argon = { ...base, provider: 'google' as const, model: 'gemini-4-argon', cache: 'implicit' as const }
    expect(costCurve(argon, DEFAULT_SHARED, 1, 2, '2026-12-01')[0].cost1h).toBeCloseTo(costCurve(argon, DEFAULT_SHARED, 1, 2, '2026-11-30')[0].cost1h * 2, 9)
  })
})

describe('costsAt, chartRange and cheaperAt', () => {
  it('costsAt picks the point for k and clamps to the curve', () => {
    expect(costsAt(curve, 2)).toBe(curve[2])
    expect(costsAt(curve, 99)).toBe(curve[12])
    expect(costsAt(curve, -1)).toBe(curve[0])
    expect(costsAt(curve, 2).cost5.toFixed(2)).toBe('30.70')
  })

  it('chartRange extends the range to short + 2 (at most the maximum) only when short is beyond it', () => {
    expect(chartRange(12, 2, 40)).toBe(12)
    expect(chartRange(12, 12, 40)).toBe(12)
    expect(chartRange(12, 13, 40)).toBe(15)
    expect(chartRange(12, 30, 40)).toBe(32)
    expect(chartRange(12, 39, 40)).toBe(40)
    expect(chartRange(12, 40, 40)).toBe(40)
  })

  it('cheaperAt says which cache is cheaper and by how much, or that they are the same', () => {
    const p = costsAt(curve, 2)
    expect(cheaperAt(p)).toMatchObject({ cheaper: '1h', percent: 6 })
    expect(cheaperAt(p).saving.toFixed(2)).toBe('1.78')
    expect(cheaperAt(costsAt(curve, 0))).toMatchObject({ cheaper: '5m', percent: 10 })
    expect(cheaperAt({ cost5: 10, cost1h: 10 })).toEqual({ cheaper: null, saving: 0, percent: 0 })
    expect(cheaperAt({ cost5: 8, cost1h: 10 })).toEqual({ cheaper: '5m', saving: 2, percent: 20 })
  })
})

describe('breakEvenGrid', () => {
  const grid = breakEvenGrid(base, DEFAULT_SHARED, 12, 6)
  const cell = (short: number, long: number) => grid.find((c) => c.short === short && c.long === long)!

  it('has one cell for every short 0..maxShort and long 0..maxLong, long-major', () => {
    expect(grid).toHaveLength(13 * 7)
    expect(grid.slice(0, 3).map((c) => [c.short, c.long])).toEqual([[0, 0], [1, 0], [2, 0]])
    expect(grid.at(-1)).toMatchObject({ short: 12, long: 6 })
    expect(breakEvenGrid(base, DEFAULT_SHARED, 0, 0)).toHaveLength(1)
  })

  it('matches the round-35 numbers: short 2, long 0 is $30.70 / $28.92; short 2, long 3 is $37.82 / $40.50', () => {
    expect([cell(2, 0).cost5.toFixed(2), cell(2, 0).cost1h.toFixed(2)]).toEqual(['30.70', '28.92'])
    expect([cell(2, 3).cost5.toFixed(2), cell(2, 3).cost1h.toFixed(2)]).toEqual(['37.82', '40.50'])
    expect(cell(2, 0).saving).toBeCloseTo(30.6965 - 28.9175, 9)
    expect(cell(2, 3).saving).toBeCloseTo(37.8245 - 40.5005, 9)
  })

  it('is the same as costCurve: every row is a curve for that number of long pauses', () => {
    for (const long of [0, 2, 5]) {
      const curve = costCurve(base, DEFAULT_SHARED, 12, long)
      for (const p of curve) {
        expect(cell(p.k, long).cost5).toBeCloseTo(p.cost5, 9)
        expect(cell(p.k, long).cost1h).toBeCloseTo(p.cost1h, 9)
      }
    }
  })

  it('has cost1h constant along a row, cost5 rising along it, and saving = cost5 - cost1h', () => {
    for (const { cells } of gridRows(grid)) {
      expect(new Set(cells.map((c) => c.cost1h)).size).toBe(1)
      for (let i = 1; i < cells.length; i++) expect(cells[i].cost5).toBeGreaterThan(cells[i - 1].cost5)
      for (const c of cells) expect(c.saving).toBeCloseTo(c.cost5 - c.cost1h, 12)
    }
  })

  it('cost5 depends only on short + long, and cost1h only on long', () => {
    expect(cell(1, 3).cost5).toBeCloseTo(cell(3, 1).cost5, 9)
    expect(cell(0, 4).cost5).toBeCloseTo(cell(4, 0).cost5, 9)
    expect(cell(1, 3).cost1h).toBeCloseTo(cell(9, 3).cost1h, 12)
  })

  it('passes the date through to the prices', () => {
    const argon = { ...base, provider: 'google' as const, model: 'gemini-4-argon', cache: 'implicit' as const }
    expect(breakEvenGrid(argon, DEFAULT_SHARED, 1, 1, '2026-12-01')[3].cost1h).toBeCloseTo(breakEvenGrid(argon, DEFAULT_SHARED, 1, 1, '2026-11-30')[3].cost1h * 2, 9)
  })
})

describe('boundary and longRange', () => {
  const grid = breakEvenGrid(base, DEFAULT_SHARED, 12, 6)

  it('is the break-even of each row: 1.2587, 1.8725, 2.5144, 3.1186 for long 0 to 3', () => {
    const edge = boundary(grid)
    expect(edge.map((e) => e.long)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(edge.slice(0, 4).map((e) => +e.exact!.toFixed(4))).toEqual([1.2587, 1.8725, 2.5144, 3.1186])
    for (const e of edge) expect(e.exact).toBeCloseTo(breakEven(costCurve(base, DEFAULT_SHARED, 12, e.long)).exact!, 9)
    for (let i = 1; i < edge.length; i++) expect(edge[i].exact!).toBeGreaterThan(edge[i - 1].exact!)
  })

  it('is null for a row without a crossing within the range', () => {
    expect(boundary(breakEvenGrid(base, DEFAULT_SHARED, 3, 6)).map((e) => e.exact === null)).toEqual([false, false, false, true, true, true, true])
    expect(boundary(breakEvenGrid(base, { ...DEFAULT_SHARED, session: 10000 }, 4, 2)).every((e) => e.exact === null)).toBe(true)
  })

  it('longRange is at least 6, your count + 2, at most the maximum', () => {
    expect([0, 3, 4, 5, 8, 38, 40].map((l) => longRange(l, 40))).toEqual([6, 6, 6, 7, 10, 40, 40])
  })
})

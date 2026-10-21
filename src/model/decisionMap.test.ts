import { describe, expect, it } from 'vitest'
import { DEFAULT_SETUPS, DEFAULT_SHARED } from '../data/defaults'
import { breakEvenGrid, type GridCell } from './breakEven'
import { bucketGrid, cellLines, savingStep, stepColor } from './decisionMap'

const money = (v: number) => `$${v.toFixed(2)}`

describe('savingStep', () => {
  it('the sign picks the pole: positive (1 hour cache cheaper) is red, negative is blue', () => {
    expect(savingStep(5, 20, 10)).toMatchObject({ side: '1h' })
    expect(savingStep(-5, 20, 10)).toMatchObject({ side: '5m' })
  })

  it('the intensity is one of four quarters of the strongest saving, the strongest being step 4', () => {
    const steps = [0.1, 0.25, 0.26, 0.5, 0.51, 0.75, 0.76, 1].map((r) => savingStep(r * 10, 20, 10).step)
    expect(steps).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
    expect(savingStep(-10, 20, 10).step).toBe(4)
    expect(savingStep(1000, 20, 10).step).toBe(4)
  })

  it('under 1% of the cheaper cost it is neutral, at 1% it is the first step', () => {
    expect(savingStep(0.199, 20, 100)).toEqual({ side: 'even', step: 0 })
    expect(savingStep(-0.199, 20, 100)).toEqual({ side: 'even', step: 0 })
    expect(savingStep(0, 20, 100)).toEqual({ side: 'even', step: 0 })
    expect(savingStep(0.2, 20, 100)).toEqual({ side: '1h', step: 1 })
    expect(savingStep(5, 20, 0)).toEqual({ side: 'even', step: 0 })
  })

  it('stepColor mixes the pole into the grey in quarters, and neutral is the grey', () => {
    expect(stepColor({ side: '1h', step: 2 })).toBe('color-mix(in oklab, var(--pole-red) 50%, var(--pole-neutral))')
    expect(stepColor({ side: '5m', step: 4 })).toBe('color-mix(in oklab, var(--pole-blue) 100%, var(--pole-neutral))')
    expect(stepColor({ side: '5m', step: 1 })).toContain('--pole-blue) 25%')
    expect(stepColor({ side: 'even', step: 0 })).toBe('var(--pole-neutral)')
  })
})

describe('bucketGrid and cellLines', () => {
  const grid = breakEvenGrid(DEFAULT_SETUPS.A, DEFAULT_SHARED, 12, 6)
  const buckets = bucketGrid(grid)
  const at = (short: number, long: number) => grid.find((c) => c.short === short && c.long === long) as GridCell

  it('puts blue at few short pauses and red at many, scaled to the strongest saving on the map', () => {
    expect(buckets.get(at(0, 0))).toMatchObject({ side: '5m' })
    expect(buckets.get(at(12, 0))).toMatchObject({ side: '1h', step: 4 })
    expect(buckets.get(at(2, 0))).toMatchObject({ side: '1h' })
    expect(buckets.get(at(1, 0))).toMatchObject({ side: '5m' })
    expect(new Set([...buckets.values()].map((b) => b.step)).size).toBeGreaterThan(2)
  })

  it('the break-even crossing is where the colour flips along a row', () => {
    const row = (long: number) => grid.filter((c) => c.long === long).map((c) => buckets.get(c)!.side)
    expect(row(0).indexOf('1h')).toBeGreaterThanOrEqual(2)
    expect(row(0).slice(0, 2)).not.toContain('1h')
  })

  it('the words of a cell: the pauses, both costs, and who saves what', () => {
    expect(cellLines(at(2, 0), money)).toEqual(['5–60 min: 2 · over 60 min: 0', '5 min cache $30.70', '1 hour cache $28.92', '1 hour cache saves $1.78'])
    expect(cellLines(at(2, 3), money)).toEqual(['5–60 min: 2 · over 60 min: 3', '5 min cache $37.82', '1 hour cache $40.50', '1 hour cache costs $2.68 more'])
  })
})

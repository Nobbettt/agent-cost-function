import { describe, expect, it } from 'vitest'
import { compare } from '../model/compare'
import { simulate } from '../model/simulate'
import { DEFAULT_SETUPS, DEFAULT_SHARED } from './defaults'
import { MODELS } from './pricing'

const a = simulate(DEFAULT_SETUPS.A, DEFAULT_SHARED)
const b = simulate(DEFAULT_SETUPS.B, DEFAULT_SHARED)
const usd = (v: number) => v.toFixed(2)

describe('default setups: the 5 minute against the 1 hour cache', () => {
  it('are both Claude Opus 5.5, differing only in the cache', () => {
    expect(DEFAULT_SETUPS.A).toEqual({ ...DEFAULT_SETUPS.B, id: 'A', cache: '5m' })
    expect(DEFAULT_SETUPS.B.cache).toBe('1h')
    expect([DEFAULT_SETUPS.A.interruptions, DEFAULT_SETUPS.B.interruptions]).toEqual([7, 7])
    expect('pause' in DEFAULT_SETUPS.A).toBe(false)
  })

  it('reach the same request count', () => {
    expect(a.totals.requests).toBe(131)
    expect(b.totals.requests).toBe(131)
  })

  it('every interruption breaks the cache for both: 7 misses each', () => {
    expect(a.points.filter((p) => p.miss)).toHaveLength(7)
    expect(b.points.filter((p) => p.miss)).toHaveLength(7)
    expect(a.totals.rewrite).toBeGreaterThan(0)
    expect(b.totals.rewrite).toBeGreaterThan(0)
  })

  it('A totals: reads $12.40, writes $4.97, re-writes $17.31, output $7.86, total $42.55', () => {
    expect(['read', 'write', 'rewrite', 'output', 'total'].map((k) => usd(a.totals[k as keyof typeof a.totals]))).toEqual(['12.40', '4.97', '17.31', '7.86', '42.55'])
  })

  it('B totals: reads $12.40, writes $7.96, re-writes $27.70, output $7.86, total $55.93', () => {
    expect(['read', 'write', 'rewrite', 'output', 'total'].map((k) => usd(b.totals[k as keyof typeof b.totals]))).toEqual(['12.40', '7.96', '27.70', '7.86', '55.93'])
  })

  it('B writes and re-writes cost 2x input against A at 1.25x; reads and output are equal', () => {
    expect(b.totals.write).toBeCloseTo(a.totals.write * (2 / 1.25), 9)
    expect(b.totals.rewrite).toBeCloseTo(a.totals.rewrite * (2 / 1.25), 9)
    expect(b.totals.read).toBeCloseTo(a.totals.read, 9)
    expect(b.totals.output).toBeCloseTo(a.totals.output, 9)
  })

  it('A re-writes the sum of the contexts before each break at 1.25x input', () => {
    const inRate = MODELS['claude-opus-5-5'].in / 1e6
    const rewrites = a.points.flatMap((p, i) => (p.miss ? [a.points[i - 1].x] : [])).reduce((sum, prev) => sum + prev * inRate * 1.25, 0)
    expect(a.totals.rewrite).toBeCloseTo(rewrites, 9)
  })

  it('compares at 995K: A $42.55, B $55.93, A is cheaper and saves $13.37 (24%)', () => {
    const c = compare([{ id: 'A', run: a }, { id: 'B', run: b }])
    expect(c.common).toBe(995000)
    expect(c.values.map((v) => usd(v.value))).toEqual(['42.55', '55.93'])
    expect(c).toMatchObject({ cheapest: 'A', mostExpensive: 'B', percent: 24, capped: false })
    expect(usd(c.saving)).toBe('13.37')
  })
})

import { describe, expect, it } from 'vitest'
import { compare } from '../model/compare'
import { simulate } from '../model/simulate'
import { DEFAULT_SETUP_LIST, DEFAULT_SETUPS, DEFAULT_SHARED } from './defaults'
import { MODELS } from './pricing'

const a = simulate(DEFAULT_SETUPS.A, DEFAULT_SHARED)
const b = simulate(DEFAULT_SETUPS.B, DEFAULT_SHARED)
const c = simulate(DEFAULT_SETUPS.C, DEFAULT_SHARED)
const usd = (v: number) => v.toFixed(2)

describe('default setups: 5 minute and 1 hour cache with breaks, and the 5 minute cache without', () => {
  it('are both Claude Opus 5.5, differing only in the cache', () => {
    expect(DEFAULT_SETUPS.A).toEqual({ ...DEFAULT_SETUPS.B, id: 'A', cache: '5m' })
    expect(DEFAULT_SETUPS.B.cache).toBe('1h')
    expect([DEFAULT_SETUPS.A.interruptions, DEFAULT_SETUPS.B.interruptions]).toEqual([7, 7])
    expect('pause' in DEFAULT_SETUPS.A).toBe(false)
  })

  it('C is A without any interruptions, and the list is A, B, C', () => {
    expect(DEFAULT_SETUPS.C).toEqual({ ...DEFAULT_SETUPS.A, id: 'C', interruptions: 0 })
    expect(DEFAULT_SETUP_LIST.map((x) => x.id)).toEqual(['A', 'B', 'C'])
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

  it('C totals: 131 requests, reads $13.10, writes $4.97, no re-writes, output $7.86, total $25.93, no misses', () => {
    expect(c.totals.requests).toBe(131)
    expect(['read', 'write', 'rewrite', 'output', 'total'].map((k) => usd(c.totals[k as keyof typeof c.totals]))).toEqual(['13.10', '4.97', '0.00', '7.86', '25.93'])
    expect(c.totals.rewrite).toBe(0)
    expect(c.points.some((p) => p.miss)).toBe(false)
  })

  it('C writes like A and reads more, because no request skips its cache read', () => {
    expect(c.totals.write).toBeCloseTo(a.totals.write, 9)
    expect(c.totals.output).toBeCloseTo(a.totals.output, 9)
    expect(c.totals.read).toBeGreaterThan(a.totals.read)
  })

  it('compares at 995K: A $42.55, B $55.93, C $25.93; C is cheapest and saves $29.99 (54%) against B', () => {
    const cmp = compare([{ id: 'A', run: a }, { id: 'B', run: b }, { id: 'C', run: c }])
    expect(cmp.common).toBe(995000)
    expect(cmp.values.map((v) => usd(v.value))).toEqual(['42.55', '55.93', '25.93'])
    expect(cmp).toMatchObject({ cheapest: 'C', mostExpensive: 'B', percent: 54, capped: false })
    expect(usd(cmp.saving)).toBe('29.99')
  })

  it('A against B alone is still A cheaper by $13.37 (24%)', () => {
    const cmp = compare([{ id: 'A', run: a }, { id: 'B', run: b }])
    expect(cmp).toMatchObject({ cheapest: 'A', mostExpensive: 'B', percent: 24 })
    expect(usd(cmp.saving)).toBe('13.37')
  })
})

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
  it('are both Opus 5.5, differing only in the cache and the interruptions (6 and 1)', () => {
    expect(DEFAULT_SETUPS.A).toEqual({ ...DEFAULT_SETUPS.B, id: 'A', cache: '5m', interruptions: 6 })
    expect(DEFAULT_SETUPS.B.cache).toBe('1h')
    expect([DEFAULT_SETUPS.A.interruptions, DEFAULT_SETUPS.B.interruptions, DEFAULT_SETUPS.C.interruptions]).toEqual([6, 1, 0])
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

  it('every interruption breaks the cache: A has 6 misses, B has 1', () => {
    expect(a.points.filter((p) => p.miss)).toHaveLength(6)
    expect(b.points.filter((p) => p.miss)).toHaveLength(1)
    expect(a.totals.rewrite).toBeGreaterThan(0)
    expect(b.totals.rewrite).toBeGreaterThan(0)
  })

  it('A totals: reads $12.50, writes $4.97, re-writes $14.89, output $7.86, total $40.22', () => {
    expect(['read', 'write', 'rewrite', 'output', 'total'].map((k) => usd(a.totals[k as keyof typeof a.totals]))).toEqual(['12.50', '4.97', '14.89', '7.86', '40.22'])
  })

  it('B totals: reads $13.00, writes $7.96, re-writes $3.94, output $7.86, total $32.76', () => {
    expect(['read', 'write', 'rewrite', 'output', 'total'].map((k) => usd(b.totals[k as keyof typeof b.totals]))).toEqual(['13.00', '7.96', '3.94', '7.86', '32.76'])
  })

  it('B writes cost 2x input against A at 1.25x, and output is equal; B reads more, because it skips fewer cache reads', () => {
    expect(b.totals.write).toBeCloseTo(a.totals.write * (2 / 1.25), 9)
    expect(b.totals.output).toBeCloseTo(a.totals.output, 9)
    expect(b.totals.read).toBeGreaterThan(a.totals.read)
  })

  it('B re-writes the context before its one break at 2x input', () => {
    const inRate = MODELS['claude-opus-5-5'].in / 1e6
    const rewrites = b.points.flatMap((p, i) => (p.miss ? [b.points[i - 1].x] : [])).reduce((sum, prev) => sum + prev * inRate * 2, 0)
    expect(b.totals.rewrite).toBeCloseTo(rewrites, 9)
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

  it('C writes like A and reads more than A and B, because no request skips its cache read', () => {
    expect(c.totals.write).toBeCloseTo(a.totals.write, 9)
    expect(c.totals.output).toBeCloseTo(a.totals.output, 9)
    expect(c.totals.read).toBeGreaterThan(a.totals.read)
    expect(c.totals.read).toBeGreaterThan(b.totals.read)
  })

  it('compares at 995K: A $40.22, B $32.76, C $25.93; C is cheapest and saves $14.29 (36%) against A', () => {
    const cmp = compare([{ id: 'A', run: a }, { id: 'B', run: b }, { id: 'C', run: c }])
    expect(cmp.common).toBe(995000)
    expect(cmp.values.map((v) => usd(v.value))).toEqual(['40.22', '32.76', '25.93'])
    expect(cmp).toMatchObject({ cheapest: 'C', mostExpensive: 'A', percent: 36, capped: false })
    expect(usd(cmp.saving)).toBe('14.29')
  })

  it('A against B alone: B (1 hour cache, 1 break) is cheaper by $7.47 (19%)', () => {
    const cmp = compare([{ id: 'A', run: a }, { id: 'B', run: b }])
    expect(cmp).toMatchObject({ cheapest: 'B', mostExpensive: 'A', percent: 19 })
    expect(usd(cmp.saving)).toBe('7.47')
  })
})

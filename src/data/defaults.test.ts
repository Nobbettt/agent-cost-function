import { describe, expect, it } from 'vitest'
import { compare } from '../model/compare'
import { simulate } from '../model/simulate'
import { DEFAULT_SETUPS, DEFAULT_SHARED } from './defaults'
import { MODELS } from './pricing'

const a = simulate(DEFAULT_SETUPS.A, DEFAULT_SHARED)
const b = simulate(DEFAULT_SETUPS.B, DEFAULT_SHARED)

describe('default setups: the cache TTL trade-off', () => {
  it('are both Claude Opus 5.5, differing only in cache lifetime', () => {
    expect(DEFAULT_SETUPS.A).toEqual({ ...DEFAULT_SETUPS.B, id: 'A', cache: '5m' })
    expect(DEFAULT_SETUPS.B.cache).toBe('1h')
    expect([DEFAULT_SETUPS.A.interruptions, DEFAULT_SETUPS.A.pause]).toEqual([7, 6])
  })

  it('reach the same request count', () => {
    expect(a.totals.requests).toBe(b.totals.requests)
    expect(a.points.length).toBe(b.points.length)
  })

  it('A: the 6 min pause outlives the 5 min cache, so all 7 pauses re-write', () => {
    expect(a.points.filter((p) => p.paused)).toHaveLength(7)
    expect(a.points.filter((p) => p.miss)).toHaveLength(7)
    expect(a.totals.rewrite).toBeGreaterThan(0)
  })

  it('B: the 1 hour cache survives every pause, so nothing is re-written', () => {
    expect(b.points.filter((p) => p.paused)).toHaveLength(7)
    expect(b.points.filter((p) => p.miss)).toHaveLength(0)
    expect(b.totals.rewrite).toBe(0)
  })

  it('B writes cost 2x input against A at 1.25x, and output is equal', () => {
    expect(b.totals.write).toBeCloseTo(a.totals.write * (2 / 1.25), 9)
    expect(b.totals.output).toBeCloseTo(a.totals.output, 9)
  })

  it('A skips the cache read on each missed request: it reads less than B by exactly those reads', () => {
    const inRate = MODELS['claude-opus-5-5'].in / 1e6
    const missedPrev = a.points.flatMap((p, i) => (p.miss ? [a.points[i - 1].x] : []))
    const missedReads = missedPrev.reduce((sum, prev) => sum + prev * inRate * MODELS['claude-opus-5-5'].read, 0)
    const rewrites = missedPrev.reduce((sum, prev) => sum + prev * inRate * 1.25, 0)
    expect(a.totals.read).toBeLessThan(b.totals.read)
    expect(a.totals.read + missedReads).toBeCloseTo(b.totals.read, 9)
    expect(a.totals.rewrite).toBeCloseTo(rewrites, 9)
  })

  it('compares at 995K: A $42.55, B $28.92, B is 32% cheaper, neither run capped', () => {
    const c = compare([{ id: 'A', run: a }, { id: 'B', run: b }])
    expect(c.common).toBe(995000)
    expect(c.values.map((v) => v.value.toFixed(2))).toEqual(['42.55', '28.92'])
    expect(c).toMatchObject({ cheapest: 'B', mostExpensive: 'A', percent: 32, capped: false })
  })
})

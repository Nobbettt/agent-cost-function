import { describe, expect, it } from 'vitest'
import { DEFAULT_SETUPS, DEFAULT_SHARED } from '../data/defaults'
import { MODELS } from '../data/pricing'
import { rates, simulate } from './simulate'
import type { Setup, Shared } from './types'

const usd = (v: number) => v.toFixed(2)
const setupOf = (patch: Partial<Setup>): Setup => ({ ...DEFAULT_SETUPS.A, ...patch })

describe('simulate: known answer', () => {
  it('Sonnet 5.5, 10K base, 10K growth, 30K session, no output costs 0.078', () => {
    const shared: Shared = { ...DEFAULT_SHARED, session: 30000, base: 10000, growth: 10000, visibleOut: 0 }
    const run = simulate(
      setupOf({ model: 'claude-sonnet-5-5', cache: '5m', effort: 'none', reasoning: 'dropped', interruptions: 0, pause: 0 }),
      shared,
    )
    expect(run.totals.requests).toBe(3)
    expect(Math.abs(run.totals.total - 0.078)).toBeLessThan(1e-9)
  })
})

describe('simulate: parity with the prototype defaults', () => {
  it('setup A: Claude Opus 5.5, 5m cache', () => {
    const { totals } = simulate(DEFAULT_SETUPS.A, DEFAULT_SHARED)
    expect(totals.requests).toBe(131)
    expect(usd(totals.read)).toBe('12.80')
    expect(usd(totals.write)).toBe('4.97')
    expect(usd(totals.rewrite)).toBe('7.42')
    expect(usd(totals.output)).toBe('7.86')
    expect(usd(totals.total)).toBe('33.06')
  })

  it('setup B: GPT-5.6 Sol, 30m cache, ends at the 922K max input', () => {
    const run = simulate(DEFAULT_SETUPS.B, DEFAULT_SHARED)
    expect(run.end).toBe(922000)
    expect(run.points.at(-1)?.x).toBe(920000)
    expect(run.totals.requests).toBe(121)
    expect(usd(run.totals.read)).toBe('42.91')
    expect(usd(run.totals.write)).toBe('7.86')
    expect(run.totals.rewrite).toBe(0)
    expect(usd(run.totals.output)).toBe('9.87')
    expect(usd(run.totals.total)).toBe('60.64')
  })

  it('marks the three expired pauses of A as misses and none for B', () => {
    const a = simulate(DEFAULT_SETUPS.A, DEFAULT_SHARED)
    const b = simulate(DEFAULT_SETUPS.B, DEFAULT_SHARED)
    expect(a.points.filter((p) => p.paused)).toHaveLength(3)
    expect(a.points.filter((p) => p.miss)).toHaveLength(3)
    expect(b.points.filter((p) => p.paused)).toHaveLength(3)
    expect(b.points.filter((p) => p.miss)).toHaveLength(0)
  })
})

describe('simulate: cache lifetime', () => {
  it('a pause shorter than the TTL keeps the cache (no re-write)', () => {
    const run = simulate(setupOf({ pause: 3 }), DEFAULT_SHARED)
    expect(run.totals.rewrite).toBe(0)
    expect(run.points.filter((p) => p.paused)).toHaveLength(3)
    expect(run.points.some((p) => p.miss)).toBe(false)
  })

  it('a pause equal to the TTL does not expire it', () => {
    expect(simulate(setupOf({ pause: 5 }), DEFAULT_SHARED).totals.rewrite).toBe(0)
  })

  it('a pause longer than the TTL re-writes the whole previous context', () => {
    expect(simulate(setupOf({ pause: 6 }), DEFAULT_SHARED).totals.rewrite).toBeGreaterThan(0)
  })

  it('falls back to the first cache option when the setup names one the model lacks', () => {
    const run = simulate(setupOf({ cache: '30m' }), DEFAULT_SHARED)
    expect(run.totals.total).toBe(simulate(DEFAULT_SETUPS.A, DEFAULT_SHARED).totals.total)
  })
})

describe('rates: long prompt multipliers', () => {
  const sol = MODELS['gpt-5.6-sol']
  it('OpenAI bills 2x input and 1.5x output above 272K', () => {
    expect(rates(sol, 272000)).toEqual({ in: 4 / 1e6, out: 20 / 1e6 })
    const long = rates(sol, 272001)
    expect(long.in).toBeCloseTo(8 / 1e6, 15)
    expect(long.out).toBeCloseTo(30 / 1e6, 15)
  })

  it('Claude Haiku 5.5 bills 5x above 100K', () => {
    const haiku = MODELS['claude-haiku-5-5']
    expect(rates(haiku, 100000)).toEqual({ in: 0.1 / 1e6, out: 0.5 / 1e6 })
    const long = rates(haiku, 100001)
    expect(long.in).toBeCloseTo(0.5 / 1e6, 15)
    expect(long.out).toBeCloseTo(2.5 / 1e6, 15)
  })

  it('models without a long-prompt rule never change rate', () => {
    expect(rates(MODELS['gpt-5.4-mini'], 1e6)).toEqual({ in: 0.75 / 1e6, out: 4.5 / 1e6 })
  })

  it('shows up in the per-request cost curve', () => {
    const run = simulate(DEFAULT_SETUPS.B, DEFAULT_SHARED)
    const before = run.points.filter((p) => p.x <= 272000 && p.x > 200000)
    const after = run.points.filter((p) => p.x > 272000 && p.x < 400000)
    // Same-size request, doubled input rate: the step jumps once the prompt passes 272K.
    expect(after[0].req).toBeGreaterThan(before.at(-1)!.req * 1.5)
  })
})

describe('simulate: max input cap', () => {
  it('gpt-5.4-mini stops at 272K even for a 1M session', () => {
    const run = simulate(
      setupOf({ provider: 'openai', model: 'gpt-5.4-mini', cache: 'in_memory', effort: 'none', reasoning: 'dropped' }),
      DEFAULT_SHARED,
    )
    expect(run.end).toBe(272000)
    expect(run.points.at(-1)!.x).toBeLessThanOrEqual(272000)
    expect(run.points.at(-1)!.x).toBeGreaterThan(272000 - DEFAULT_SHARED.growth)
  })

  it('a session shorter than the model max wins', () => {
    expect(simulate(DEFAULT_SETUPS.A, { ...DEFAULT_SHARED, session: 100000 }).end).toBe(100000)
  })
})

describe('simulate: earlier reasoning kept vs dropped', () => {
  it('kept grows the context faster, so fewer requests reach the same size', () => {
    const kept = simulate(setupOf({ reasoning: 'kept' }), DEFAULT_SHARED)
    const dropped = simulate(setupOf({ reasoning: 'dropped' }), DEFAULT_SHARED)
    expect(kept.totals.requests).toBe(131)
    expect(dropped.totals.requests).toBe(197)
  })
})

describe('simulate: purity', () => {
  it('does not mutate its inputs or the model table', () => {
    const setup = Object.freeze({ ...DEFAULT_SETUPS.A })
    const shared = Object.freeze({ ...DEFAULT_SHARED, thinking: Object.freeze({ ...DEFAULT_SHARED.thinking }) })
    const model = JSON.stringify(MODELS)
    expect(() => simulate(setup, shared)).not.toThrow()
    expect(JSON.stringify(MODELS)).toBe(model)
    expect(simulate(setup, shared)).toEqual(simulate(setup, shared))
  })

  it('throws on an unknown model', () => {
    expect(() => simulate(setupOf({ model: 'nope' }), DEFAULT_SHARED)).toThrow('Unknown model')
  })
})

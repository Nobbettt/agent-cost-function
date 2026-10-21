import { describe, expect, it } from 'vitest'
import { DEFAULT_SHARED } from '../data/defaults'
import { PROTOTYPE_SETUPS } from './prototype-fixtures'
import { MODELS } from '../data/pricing'
import { rates, simulate } from './simulate'
import type { Setup, Shared } from './types'

const usd = (v: number) => v.toFixed(2)
const setupOf = (patch: Partial<Setup>): Setup => ({ ...PROTOTYPE_SETUPS.A, ...patch })

describe('simulate: known answer', () => {
  it('Sonnet 5.5, 10K base, 10K growth, 30K session, no output costs 0.078', () => {
    const shared: Shared = { ...DEFAULT_SHARED, session: 30000, base: 10000, growth: 10000, visibleOut: 0 }
    const run = simulate(
      setupOf({ model: 'claude-sonnet-5-5', cache: '5m', effort: 'none', reasoning: 'dropped', interruptions: 0 }),
      shared,
    )
    expect(run.totals.requests).toBe(3)
    expect(Math.abs(run.totals.total - 0.078)).toBeLessThan(1e-9)
  })
})

describe('simulate: parity with the prototype defaults', () => {
  it('setup A: Claude Opus 5.5, 5m cache', () => {
    const { totals } = simulate(PROTOTYPE_SETUPS.A, DEFAULT_SHARED)
    expect(totals.requests).toBe(131)
    expect(usd(totals.read)).toBe('12.80')
    expect(usd(totals.write)).toBe('4.97')
    expect(usd(totals.rewrite)).toBe('7.42')
    expect(usd(totals.output)).toBe('7.86')
    expect(usd(totals.total)).toBe('33.06')
  })

  it('setup B: GPT-5.6 Sol, 30m cache, ends at the 922K max input', () => {
    const run = simulate(PROTOTYPE_SETUPS.B, DEFAULT_SHARED)
    expect(run.end).toBe(922000)
    expect(run.points.at(-1)?.x).toBe(920000)
    expect(run.totals.requests).toBe(121)
    expect(usd(run.totals.read)).toBe('42.91')
    expect(usd(run.totals.write)).toBe('7.86')
    expect(run.totals.rewrite).toBe(0)
    expect(usd(run.totals.output)).toBe('9.87')
    expect(usd(run.totals.total)).toBe('60.64')
  })

  it('marks the three interruptions of A as misses and B (no interruptions) has none', () => {
    const a = simulate(PROTOTYPE_SETUPS.A, DEFAULT_SHARED)
    const b = simulate(PROTOTYPE_SETUPS.B, DEFAULT_SHARED)
    expect(a.points.filter((p) => p.miss)).toHaveLength(3)
    expect(b.points.filter((p) => p.miss)).toHaveLength(0)
  })
})

describe('simulate: every interruption breaks the cache', () => {
  it.each([
    ['claude-opus-5-5', '5m'],
    ['claude-opus-5-5', '1h'],
    ['gpt-5.6-sol', '30m'],
    ['gpt-5.5', '24h'],
    ['gpt-5.4', 'in_memory'],
  ] as const)('%s on the %s cache: each interruption is a miss, whatever the cache lifetime', (model, cache) => {
    const run = simulate(setupOf({ model, cache, interruptions: 4, effort: model.startsWith('claude') ? 'high' : 'medium', reasoning: 'dropped' }), DEFAULT_SHARED)
    expect(run.points.filter((p) => p.miss)).toHaveLength(4)
    expect(run.totals.rewrite).toBeGreaterThan(0)
  })

  it('no interruptions means no misses and no re-writes', () => {
    for (const cache of ['5m', '1h'] as const) {
      const run = simulate(setupOf({ cache, interruptions: 0 }), DEFAULT_SHARED)
      expect(run.points.some((p) => p.miss)).toBe(false)
      expect(run.totals.rewrite).toBe(0)
    }
  })

  it('points carry one flag for it: miss (there is no separate paused flag)', () => {
    const run = simulate(setupOf({ interruptions: 2 }), DEFAULT_SHARED)
    expect(Object.keys(run.points[0]).sort()).toEqual(['cum', 'miss', 'req', 'x'])
  })

  it('a miss replaces the cache read of that request by a re-write at the cache write multiplier', () => {
    const a = simulate(setupOf({ cache: '5m', interruptions: 1 }), DEFAULT_SHARED)
    const b = simulate(setupOf({ cache: '1h', interruptions: 1 }), DEFAULT_SHARED)
    // Same requests, same reads skipped; the 1h cache re-writes at 2x against 1.25x.
    expect(b.totals.rewrite).toBeCloseTo(a.totals.rewrite * (2 / 1.25), 9)
    expect(b.totals.read).toBeCloseTo(a.totals.read, 9)
  })

  it('falls back to the first cache option when the setup names one the model lacks', () => {
    const run = simulate(setupOf({ cache: '30m' }), DEFAULT_SHARED)
    expect(run.totals.total).toBe(simulate(PROTOTYPE_SETUPS.A, DEFAULT_SHARED).totals.total)
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

  it('xAI bills 2x input and output from 200K on: 199,999 is short, 200,000 is long (inclusive)', () => {
    const grok = MODELS['grok-4.7']
    expect(rates(grok, 199999)).toEqual({ in: 2 / 1e6, out: 6 / 1e6 })
    expect(rates(grok, 200000)).toEqual({ in: 4 / 1e6, out: 12 / 1e6 })
    expect(rates(grok, 400000)).toEqual({ in: 4 / 1e6, out: 12 / 1e6 })
    const c = MODELS['grok-4.20-0309-non-reasoning']
    expect(rates(c, 199999)).toEqual({ in: 1.25 / 1e6, out: 2.5 / 1e6 })
    expect(rates(c, 200000)).toEqual({ in: 2.5 / 1e6, out: 5 / 1e6 })
  })

  it('OpenAI and Haiku stay exclusive: 272,000 and 100,000 are still short, one more is long', () => {
    expect(MODELS['gpt-5.6-sol'].longPrompt!.inclusive).toBeUndefined()
    expect(MODELS['claude-haiku-5-5'].longPrompt!.inclusive).toBeUndefined()
    expect(rates(MODELS['gpt-5.6-sol'], 272000).in).toBe(4 / 1e6)
    expect(rates(MODELS['gpt-5.6-sol'], 272001).in).toBeCloseTo(8 / 1e6, 15)
    expect(rates(MODELS['claude-haiku-5-5'], 100000).in).toBe(0.1 / 1e6)
    expect(rates(MODELS['claude-haiku-5-5'], 100001).in).toBeCloseTo(0.5 / 1e6, 15)
  })

  it('Gemini 3.1 Pro Preview bills 2x input and 1.5x output above 200K: 200,000 is short, 200,001 is long', () => {
    const pro = MODELS['gemini-3.1-pro-preview']
    expect(pro.longPrompt).toEqual({ above: 200000, inMult: 2, outMult: 1.5 })
    expect(rates(pro, 200000)).toEqual({ in: 2 / 1e6, out: 12 / 1e6 })
    const long = rates(pro, 200001)
    expect(long.in).toBeCloseTo(4 / 1e6, 15)
    expect(long.out).toBeCloseTo(18 / 1e6, 15)
    for (const id of ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']) expect(MODELS[id].longPrompt).toBeUndefined()
  })

  it('models without a long-prompt rule never change rate', () => {
    expect(rates(MODELS['gpt-5.4-mini'], 1e6)).toEqual({ in: 0.75 / 1e6, out: 4.5 / 1e6 })
  })

  it('shows up in the per-request cost curve', () => {
    const run = simulate(PROTOTYPE_SETUPS.B, DEFAULT_SHARED)
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
    expect(simulate(PROTOTYPE_SETUPS.A, { ...DEFAULT_SHARED, session: 100000 }).end).toBe(100000)
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
    const setup = Object.freeze({ ...PROTOTYPE_SETUPS.A })
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

describe('simulate: xAI known answer', () => {
  // Grok 4.7, base 100K, +50K per request, 1K output, no reasoning tokens, 300K session, one cache break.
  // Requests at 100K, 150K, 200K, 250K, 300K; the break lands on the 150K request; 200K and up are long prompts.
  const shared: Shared = { ...DEFAULT_SHARED, session: 300000, base: 100000, growth: 50000, visibleOut: 1000, thinking: { none: 0, low: 0, medium: 0, high: 0, xhigh: 0, max: 0 } }
  const grok: Setup = { id: 'A', provider: 'xai', model: 'grok-4.7', cache: 'auto', effort: 'high', reasoning: 'kept', interruptions: 1 }
  const run = simulate(grok, shared)
  const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-9)

  it('prices every request by hand: $0.206, $0.306, $0.362, $0.412, $0.462', () => {
    expect(run.points.map((p) => p.x)).toEqual([100000, 150000, 200000, 250000, 300000])
    expect(run.points.map((p) => p.miss)).toEqual([false, true, false, false, false])
    const req = [0.206, 0.306, 0.362, 0.412, 0.462]
    run.points.forEach((p, i) => close(p.req, req[i]))
  })

  it('totals: reads $0.60, writes $0.90, the break re-writes $0.20 at 1x input, output $0.048, total $1.748', () => {
    close(run.totals.read, 0.6)
    close(run.totals.write, 0.9)
    close(run.totals.rewrite, 0.2)
    close(run.totals.output, 0.048)
    close(run.totals.total, 1.748)
    expect(run.totals.requests).toBe(5)
  })

  it('the 200K request is already priced at the long rate (inclusive): reads 150K at 4 x 0.25 per M', () => {
    close(run.points[2].req - run.points[1].req, 0.056)
    close(run.points[2].req, 150000 * 4e-6 * 0.25 + 50000 * 4e-6 + 1000 * 12e-6)
  })

  it('stops at the listed context (500K), and a no-break session never re-writes', () => {
    const capped = simulate({ ...grok, interruptions: 0 }, { ...DEFAULT_SHARED })
    expect(capped.end).toBe(500000)
    expect(capped.totals.rewrite).toBe(0)
    expect(capped.points.at(-1)!.x).toBeLessThanOrEqual(500000)
  })

  it('reasoning is assumed to cost the output rate: high effort adds reasoning tokens at 6 per M', () => {
    const none = simulate({ ...grok, interruptions: 0 }, { ...shared, thinking: { ...shared.thinking, high: 0 } })
    const high = simulate({ ...grok, interruptions: 0, reasoning: 'dropped' }, { ...shared, thinking: { ...shared.thinking, high: 2000 } })
    // 2000 extra output tokens on each of the 5 requests: 2 short ones at 6 per M, 3 long ones at 12 per M.
    close(high.totals.total - none.totals.total, 2000 * 6e-6 * 2 + 2000 * 12e-6 * 3)
  })
})

describe('simulate: Google known answer', () => {
  // Gemini 3.8 Flash, base 100K, +50K per request, 1K output, no thinking tokens, 300K session, one cache break.
  const shared: Shared = { ...DEFAULT_SHARED, session: 300000, base: 100000, growth: 50000, visibleOut: 1000, thinking: { none: 0, low: 0, medium: 0, high: 0, xhigh: 0, max: 0 } }
  const flash: Setup = { id: 'A', provider: 'google', model: 'gemini-3.8-flash', cache: 'implicit', effort: 'medium', reasoning: 'kept', interruptions: 1 }
  const run = simulate(flash, shared)
  const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-9)

  it('prices every request by hand: $0.07875, $0.11625, $0.0525, $0.05625, $0.06', () => {
    expect(run.points.map((p) => p.x)).toEqual([100000, 150000, 200000, 250000, 300000])
    expect(run.points.map((p) => p.miss)).toEqual([false, true, false, false, false])
    ;[0.07875, 0.11625, 0.0525, 0.05625, 0.06].forEach((v, i) => close(run.points[i].req, v))
  })

  it('totals: reads $0.045, writes $0.225, the break re-writes $0.075 at 1x input, output $0.01875, total $0.36375', () => {
    close(run.totals.read, 0.045)
    close(run.totals.write, 0.225)
    close(run.totals.rewrite, 0.075)
    close(run.totals.output, 0.01875)
    close(run.totals.total, 0.36375)
  })

  it('3.1 Pro crosses its 200K tier: the request after 200K costs more than twice the one before per new token', () => {
    const pro = simulate({ ...flash, model: 'gemini-3.1-pro-preview', interruptions: 0 }, { ...shared, session: 250000 })
    // 100K, 150K, 200K are short (200K is not above 200K); 250K is long: read 200K*4*0.1/M = 0.08, write 50K*4/M = 0.2, out 1K*18/M = 0.018
    close(pro.points[3].req, 200000 * 4e-6 * 0.1 + 50000 * 4e-6 + 1000 * 18e-6)
    close(pro.points[2].req, 150000 * 2e-6 * 0.1 + 50000 * 2e-6 + 1000 * 12e-6)
  })

  it('stops at 1,048,576 tokens at most, which the 1M session does not reach', () => {
    expect(simulate({ ...flash, interruptions: 0 }, DEFAULT_SHARED).end).toBe(1000000)
    expect(MODELS['gemini-3.8-flash'].maxInput).toBe(1048576)
  })

  it('thinking is billed at the output rate and stays in context (kept)', () => {
    const base = simulate({ ...flash, interruptions: 0 }, shared)
    const think = simulate({ ...flash, interruptions: 0 }, { ...shared, thinking: { ...shared.thinking, medium: 1000 } })
    // 1000 thinking tokens more output per request at 3.75/M, and the context grows 1000 faster (fewer requests).
    expect(think.totals.output).toBeGreaterThan(base.totals.output)
    expect(think.points.at(-1)!.x).toBeLessThanOrEqual(300000)
  })
})

describe('simulate: prices on a date', () => {
  const shared: Shared = { ...DEFAULT_SHARED, session: 300000, base: 100000, growth: 50000, visibleOut: 1000, thinking: { none: 0, low: 0, medium: 0, high: 0, xhigh: 0, max: 0 } }
  const argon: Setup = { id: 'A', provider: 'google', model: 'gemini-4-argon', cache: 'implicit', effort: 'medium', reasoning: 'kept', interruptions: 0 }
  const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-9)

  it('Gemini 4 Argon costs $0.72 on 2026-11-30 and exactly double, $1.44, on 2026-12-01', () => {
    // 100K..300K in steps of 50K, 1K output: requests $0.21, $0.12, $0.125, $0.13, $0.135 at $2 in / $10 out / 0.05 read.
    const before = simulate(argon, shared, '2026-11-30')
    const after = simulate(argon, shared, '2026-12-01')
    close(before.totals.total, 0.72)
    close(after.totals.total, 1.44)
    close(after.totals.read, before.totals.read * 2)
    close(after.totals.write, before.totals.write * 2)
    close(after.totals.output, before.totals.output * 2)
    before.points.forEach((p, i) => close(after.points[i].req, p.req * 2))
  })

  it('without a date the base prices apply, and a date changes nothing for a model without a schedule', () => {
    close(simulate(argon, shared).totals.total, 0.72)
    const opus = PROTOTYPE_SETUPS.A
    expect(simulate(opus, DEFAULT_SHARED, '2031-01-01').totals).toEqual(simulate(opus, DEFAULT_SHARED).totals)
  })

  it('Gemini 3.8 Flash doubles on 2027-01-01 and is unchanged on 2026-12-31', () => {
    const flash: Setup = { ...argon, model: 'gemini-3.8-flash' }
    const dec = simulate(flash, shared, '2026-12-31').totals.total
    close(dec, simulate(flash, shared, '2026-11-30').totals.total)
    close(simulate(flash, shared, '2027-01-01').totals.total, dec * 2)
  })
})

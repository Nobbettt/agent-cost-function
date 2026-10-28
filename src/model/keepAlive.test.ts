import { describe, expect, it } from 'vitest'
import { MODELS } from '../data/pricing'
import { defaultInterval, hasKnownTtl, keepAlive, keepAliveCurve, type KeepAliveInput } from './keepAlive'

const OPUS: KeepAliveInput = { model: 'claude-opus-5-5', cache: '1h', context: 200000, interval: 59, pingIn: 50, pingOut: 10, returnChance: 1 }
const bare = (patch: Partial<KeepAliveInput>): KeepAliveInput => ({ ...OPUS, pingIn: 0, pingOut: 0, ...patch })
const cacheOf = (model: string, id: string) => MODELS[model].cache.find((c) => c.id === id)!

describe('defaultInterval', () => {
  it('pings a minute before the lifetime ends, or 30 s before on the 5 min cache', () => {
    expect(defaultInterval(cacheOf('claude-opus-5-5', '5m'))).toBe(4.5)
    expect(defaultInterval(cacheOf('claude-opus-5-5', '1h'))).toBe(59)
    expect(defaultInterval(cacheOf('gpt-5.6-sol', '30m'))).toBe(29)
  })
})

describe('hasKnownTtl', () => {
  it('is true for Claude 5 min and 1 hour and OpenAI 30 min, false for the best-effort caches', () => {
    expect(['5m', '1h'].map((id) => hasKnownTtl(cacheOf('claude-opus-5-5', id)))).toEqual([true, true])
    expect(hasKnownTtl(cacheOf('gpt-5.6-sol', '30m'))).toBe(true)
    expect(hasKnownTtl(cacheOf('gpt-5.4', '24h'))).toBe(false)
    expect(hasKnownTtl(cacheOf('gpt-5.4', 'in_memory'))).toBe(false)
    expect(hasKnownTtl(cacheOf('grok-4.7', 'auto'))).toBe(false)
    expect(hasKnownTtl(cacheOf('gemini-3.8-flash', 'implicit'))).toBe(false)
  })
})

describe('keepAlive', () => {
  it('Opus 5.5, 1 hour cache, 200K: a ping is the cached read plus its own uncached tokens; the re-write is 2× minus 0.05× input', () => {
    const r = keepAlive(OPUS)
    expect(r.ping).toBeCloseTo(200000 * 4e-6 * 0.05 + 50 * 4e-6 + 10 * 20e-6, 10)
    expect(r.rewrite).toBeCloseTo(1.56, 10)
    expect(r.breakEven).toBeCloseTo(1.56 / 0.0404, 6)
    expect(r.pings).toBe(38)
    expect(r.covers).toBe(38 * 59 + 60)
    expect(r).toMatchObject({ lifetime: 60, interval: 59 })
  })

  it('without ping overhead the break-even is (write − read) ÷ read: 24 pings on the 5 min cache, 39 on the 1 hour cache', () => {
    expect(keepAlive(bare({ cache: '5m', interval: 4 })).breakEven).toBeCloseTo(24, 9)
    expect(keepAlive(bare({ cache: '5m', interval: 4 })).covers).toBe(24 * 4 + 5)
    expect(keepAlive(bare({})).breakEven).toBeCloseTo(39, 9)
  })

  it('context size moves the dollars, not the count, once the ping overhead is out', () => {
    const small = keepAlive(bare({ context: 20000 }))
    const large = keepAlive(bare({ context: 900000 }))
    expect(large.rewrite / small.rewrite).toBeCloseTo(45, 9)
    expect(large.breakEven).toBeCloseTo(small.breakEven, 9)
    // With overhead, a small context makes the fixed ping tokens weigh more.
    expect(keepAlive({ ...OPUS, context: 20000 }).breakEven).toBeLessThan(keepAlive({ ...OPUS, context: 900000 }).breakEven)
  })

  it('scales the break-even by the chance you come back: the pings are paid either way', () => {
    expect(keepAlive({ ...OPUS, returnChance: 0.5 }).breakEven).toBeCloseTo(keepAlive(OPUS).breakEven / 2, 9)
    expect(keepAlive({ ...OPUS, returnChance: 0.5 }).expected).toBeCloseTo(0.78, 9)
    expect(keepAlive({ ...OPUS, returnChance: 0 })).toMatchObject({ breakEven: 0, pings: 0, covers: 60 })
  })

  it('OpenAI 30 min cache (write 1.25×, read 0.1×): 11.5 pings, 11 whole ones, every 29 min', () => {
    const r = keepAlive(bare({ model: 'gpt-5.6-sol', cache: '30m', interval: 29 }))
    expect(r.breakEven).toBeCloseTo(11.5, 9)
    expect(r).toMatchObject({ pings: 11, covers: 11 * 29 + 30 })
  })

  it('refuses a best-effort cache: with no known lifetime a ping cannot be timed', () => {
    expect(() => keepAlive(bare({ model: 'grok-4.7', cache: 'auto', interval: 4 }))).toThrow("Grok 4.7's auto cache has no known lifetime")
    expect(() => keepAlive(bare({ model: 'gpt-5.4', cache: 'in_memory', interval: 4 }))).toThrow('no known lifetime')
  })

  it('applies the long-prompt rate to both sides (Haiku 5.5 above 100K is 5×), leaving the count alone', () => {
    const r = keepAlive(bare({ model: 'claude-haiku-5-5', cache: '5m', context: 200000, interval: 4 }))
    expect(r.ping).toBeCloseTo(200000 * 0.1e-6 * 5 * 0.1, 12)
    expect(r.breakEven).toBeCloseTo(11.5, 9)
  })

  it('clamps the context to the model’s max input and the interval to 1..lifetime', () => {
    const astra = keepAlive(bare({ model: 'gpt-6-astra', cache: '30m', context: 1000000, interval: 29 }))
    expect(astra.rewrite).toBeCloseTo(922000 * 10e-6 * 2 * (1.25 - 0.1), 9)
    expect(keepAlive(bare({ cache: '5m', interval: 100 })).interval).toBe(5)
    expect(keepAlive(bare({ cache: '5m', interval: 0 })).interval).toBe(1)
  })

  it('throws on an unknown model', () => {
    expect(() => keepAlive(bare({ model: 'nope' }))).toThrow('Unknown model: nope')
  })
})

describe('keepAliveCurve', () => {
  it('steps the ping spend up at every ping and the expected re-write up once the cache has gone', () => {
    const r = keepAlive(bare({ cache: '5m', interval: 4 }))
    const curve = keepAliveCurve(r, 13)
    expect(curve.map((p) => p.minutes)).toEqual([0, 4, 5, 8, 12, 13])
    expect(curve.map((p) => +(p.keep / r.ping).toFixed(9))).toEqual([0, 1, 1, 2, 3, 3])
    expect(curve.map((p) => p.die)).toEqual([0, 0, r.expected, r.expected, r.expected, r.expected])
  })
})

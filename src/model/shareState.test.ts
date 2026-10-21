import { describe, expect, it } from 'vitest'
import { DEFAULT_SETUP_LIST, DEFAULT_SETUPS, DEFAULT_SHARED } from '../data/defaults'
import { MODELS, reasoningOptions } from '../data/pricing'
import { SETUP_IDS } from '../data/series'
import { decodeState, encodeState, type ShareState } from './shareState'
import type { Setup, Shared } from './types'

const A = DEFAULT_SETUPS.A
const B = DEFAULT_SETUPS.B
const state = (setups: readonly Setup[], extra: Partial<ShareState> = {}): ShareState => ({ setups, shared: DEFAULT_SHARED, currency: 'USD', ...extra })
const C: Setup = { id: 'C', provider: 'openai', model: 'gpt-5.6-sol', cache: '30m', effort: 'medium', reasoning: 'dropped', interruptions: 3 }
const D: Setup = { id: 'D', provider: 'claude', model: 'claude-haiku-5-5', cache: '1h', effort: 'low', reasoning: 'kept', interruptions: 0 }
const roundTrip = (s: ShareState) => decodeState(encodeState(s))

describe('encodeState', () => {
  it('is empty for the all-default state, so the default link is a clean "/"', () => {
    expect(encodeState(state(DEFAULT_SETUP_LIST))).toBe('')
  })

  it('writes v=1, one readable param per setup id, and nothing else by default', () => {
    expect(encodeState(state([A, { ...B, interruptions: 2 }]))).toBe('v=1&a=claude-opus-5-5,5m,high,kept,6&b=claude-opus-5-5,1h,high,kept,2')
  })

  it('an old link that spells out the previous defaults (7 and 7) is no longer the default state and keeps exactly 7', () => {
    const old = 'v=1&a=claude-opus-5-5,5m,high,kept,7&b=claude-opus-5-5,1h,high,kept,7&c=claude-opus-5-5,5m,high,kept,0'
    const d = decodeState(`?${old}`)
    expect(d.setups.map((x) => x.interruptions)).toEqual([7, 7, 0])
    expect(encodeState(state(d.setups))).toBe(old)
  })

  it('the two-setup state is no longer the default, so it is written out and decodes to exactly A and B', () => {
    const q = encodeState(state([A, B]))
    expect(q).toBe('v=1&a=claude-opus-5-5,5m,high,kept,6&b=claude-opus-5-5,1h,high,kept,1')
    expect(roundTrip(state([A, B])).setups).toEqual([A, B])
  })

  it('the three default setups encode to nothing, and removing or changing one does not', () => {
    expect(encodeState(state(DEFAULT_SETUP_LIST))).toBe('')
    expect(encodeState(state([A, B, { ...DEFAULT_SETUPS.C, interruptions: 1 }]))).not.toBe('')
    expect(encodeState(state([B, DEFAULT_SETUPS.C]))).not.toBe('')
  })

  it('keys setups by their id, so a link with A and C shows A and C', () => {
    expect(encodeState(state([A, C]))).toBe('v=1&a=claude-opus-5-5,5m,high,kept,6&c=gpt-5.6-sol,30m,medium,dropped,3')
  })

  it('adds adv only when the shared numbers differ, in the documented order', () => {
    const shared: Shared = { ...DEFAULT_SHARED, growth: 7000, thinking: { ...DEFAULT_SHARED.thinking, max: 12000 } }
    expect(encodeState(state(DEFAULT_SETUP_LIST, { shared }))).toBe(
      'v=1&a=claude-opus-5-5,5m,high,kept,6&b=claude-opus-5-5,1h,high,kept,1&c=claude-opus-5-5,5m,high,kept,0&adv=1000000,20000,7000,500,0,300,1000,2500,5000,12000',
    )
  })

  it('adds cur only when it is not USD', () => {
    const q = encodeState(state(DEFAULT_SETUP_LIST, { currency: 'SEK' }))
    expect(q).toContain('&cur=SEK')
    expect(encodeState(state([A, C]))).not.toContain('cur=')
  })

  it('keeps the commas literal and rounds fractional shared values', () => {
    const q = encodeState(state(DEFAULT_SETUP_LIST, { shared: { ...DEFAULT_SHARED, visibleOut: 700.4 } }))
    expect(q).not.toContain('%2C')
    expect(q).toContain('adv=1000000,20000,5000,700,')
    // A value that rounds to the default is not a difference at all.
    expect(encodeState(state(DEFAULT_SETUP_LIST, { shared: { ...DEFAULT_SHARED, visibleOut: 500.4 } }))).toBe('')
  })
})

describe('encode / decode round trip', () => {
  it('two setups with non-default values', () => {
    const s = state([{ ...A, effort: 'low', interruptions: 0 }, { ...B, reasoning: 'dropped', cache: '5m' }])
    const d = roundTrip(s)
    expect(d.setups).toEqual(s.setups)
    expect(d.versionMismatch).toBe(false)
  })

  it('three and four setups, with their ids', () => {
    for (const list of [[A, B, C], [A, B, C, D], [B, D]] as Setup[][]) {
      const d = roundTrip(state(list))
      expect(d.setups).toEqual(list)
    }
  })

  it('non-default shared numbers and the currency', () => {
    const shared: Shared = { session: 500000, base: 10000, growth: 2500, visibleOut: 800, thinking: { none: 0, low: 100, medium: 400, high: 900, xhigh: 2000, max: 4000 } }
    const d = roundTrip(state([A, B], { shared, currency: 'EUR' }))
    expect(d.shared).toEqual(shared)
    expect(d.currency).toBe('EUR')
  })

  it('the clean link decodes to the defaults', () => {
    const d = decodeState(encodeState(state(DEFAULT_SETUP_LIST)))
    expect(d.setups).toEqual(DEFAULT_SETUP_LIST)
    expect(d.shared).toEqual(DEFAULT_SHARED)
    expect(d.currency).toBeNull()
    expect(d.hadParams).toBe(false)
  })
})

describe('decodeState: versions', () => {
  it('a missing v is read as version 1', () => {
    const d = decodeState('a=claude-opus-5-5,5m,high,kept,2&b=claude-opus-5-5,1h,high,kept,3')
    expect(d.setups.map((s) => s.interruptions)).toEqual([2, 3])
    expect(d.versionMismatch).toBe(false)
  })

  it('any other version ignores every param, uses the defaults and flags it', () => {
    const d = decodeState('v=9&a=claude-opus-5-5,5m,high,kept,2&b=claude-opus-5-5,1h,high,kept,3&adv=20000,0,500,0,0,0,0,0,0,0&cur=SEK')
    expect(d).toMatchObject({ versionMismatch: true, currency: null, hadParams: true })
    expect(d.setups).toEqual(DEFAULT_SETUP_LIST)
    expect(d.shared).toEqual(DEFAULT_SHARED)
  })

  it.each(['v=', 'v=0', 'v=1.0', 'v=abc', 'v=01'])('rejects %s as an unknown version', (q) => {
    expect(decodeState(q).versionMismatch).toBe(true)
  })
})

describe('decodeState: setups', () => {
  it('drops a setup with an unknown model', () => {
    const d = decodeState('v=1&a=nope,5m,high,kept,2&b=claude-opus-5-5,1h,high,kept,3&c=gpt-5.6-sol,30m,medium,dropped,1')
    expect(d.setups.map((s) => s.id)).toEqual(['B', 'C'])
  })

  it('does not trust prototype keys as models', () => {
    for (const model of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      expect(decodeState(`a=${model},5m,high,kept,2`).setups.map((s) => s.id)).toEqual(['A', 'B'])
    }
  })

  it('fixes an invalid cache, effort or reasoning with the model-switch fallbacks', () => {
    const [s] = decodeState('a=claude-opus-5-5,24h,none,nonsense,2&b=claude-opus-5-5,1h,high,kept,3').setups
    expect(s).toMatchObject({ id: 'A', provider: 'claude', cache: '5m', effort: 'medium', reasoning: 'kept' })
    const d = decodeState('a=gpt-5.5,5m,max,kept,1&b=claude-opus-5-5,1h,high,kept,3').setups[0]
    expect(d).toMatchObject({ provider: 'openai', cache: '24h', effort: 'medium', reasoning: 'dropped' })
  })

  it('derives the provider from the model, never from the link', () => {
    expect(decodeState('a=gpt-5.6-sol,30m,medium,dropped,1&b=claude-opus-5-5,1h,high,kept,3').setups[0].provider).toBe('openai')
  })

  it('clamps interruptions to the input range and falls back (to the default 6) for non-numbers', () => {
    const get = (v: string) => decodeState(`a=claude-opus-5-5,5m,high,kept,${v}&b=claude-opus-5-5,1h,high,kept,3`).setups[0].interruptions
    expect(get('999')).toBe(50)
    expect(get('0')).toBe(0)
    expect(get('-4')).toBe(6)
    expect(get('abc')).toBe(6)
    expect(get('2.5')).toBe(6)
    expect(get('')).toBe(6)
    expect(decodeState('a=claude-opus-5-5,5m,high,kept&b=claude-opus-5-5,1h,high,kept,3').setups[0].interruptions).toBe(6)
  })

  it('accepts only the ids A to D, each at most once, so never more than four', () => {
    const q = SETUP_IDS.map((id) => `${id.toLowerCase()}=claude-opus-5-5,5m,high,kept,1`).join('&') + '&e=claude-opus-5-5,5m,high,kept,1&A=claude-opus-5-5,5m,high,kept,9&a=claude-opus-5-5,1h,high,kept,2'
    const d = decodeState(q)
    expect(d.setups.map((s) => s.id)).toEqual(['A', 'B', 'C', 'D'])
    expect(d.setups[0].cache).toBe('5m')
  })

  it('pads to two setups with the defaults, in order, keeping letter order', () => {
    expect(decodeState('c=gpt-5.6-sol,30m,medium,dropped,1').setups.map((s) => s.id)).toEqual(['A', 'C'])
    // One valid setup is padded with exactly one default, never up to the three defaults.
    expect(decodeState('a=claude-opus-5-5,1h,low,kept,1').setups.map((s) => s.id)).toEqual(['A', 'B'])
    expect(decodeState('b=claude-opus-5-5,1h,low,kept,1').setups.map((s) => s.id)).toEqual(['A', 'B'])
    expect(decodeState('d=claude-opus-5-5,1h,low,kept,1').setups).toEqual([{ ...A }, expect.objectContaining({ id: 'D', effort: 'low' })])
    expect(decodeState('v=1').setups).toEqual(DEFAULT_SETUP_LIST)
    // Setup params that all fail still leave the minimum of two (A then B), never the default C.
    expect(decodeState('b=nope').setups).toEqual([A, B])
    expect(decodeState('a=nope&b=nope&c=nope&d=nope').setups).toEqual([A, B])
  })
})

describe('decodeState: adv and cur', () => {
  const adv = (v: string) => decodeState(`v=1&adv=${v}`).shared

  it('reads ten integers in order', () => {
    expect(adv('500000,10000,2500,800,1,2,3,4,5,6')).toEqual({
      session: 500000, base: 10000, growth: 2500, visibleOut: 800, thinking: { none: 1, low: 2, medium: 3, high: 4, xhigh: 5, max: 6 },
    })
  })

  it('clamps each value to its input range', () => {
    expect(adv('99999999,999999999,1,999999,999999999,0,0,0,0,0')).toMatchObject({ session: 1000000, base: 200000, growth: 500, visibleOut: 64000, thinking: expect.objectContaining({ none: 128000 }) })
    expect(adv('1,0,0,0,0,0,0,0,0,0')).toMatchObject({ session: 10000, growth: 500 })
  })

  it('base never exceeds the session length', () => {
    expect(adv('50000,150000,5000,500,0,0,0,0,0,0')).toMatchObject({ session: 50000, base: 50000 })
  })

  it.each([
    ['too few', '1000000,20000,5000,500,0,300,1000,2500,5000'],
    ['too many', '1000000,20000,5000,500,0,300,1000,2500,5000,10000,1'],
    ['a non-number', '1000000,20000,abc,500,0,300,1000,2500,5000,10000'],
    ['a decimal', '1000000,20000,5000.5,500,0,300,1000,2500,5000,10000'],
    ['a negative', '1000000,20000,-5,500,0,300,1000,2500,5000,10000'],
    ['an empty slot', '1000000,,5000,500,0,300,1000,2500,5000,10000'],
    ['empty', ''],
  ])('ignores a malformed adv entirely (%s) and uses the defaults', (_name, value) => {
    expect(adv(value)).toEqual(DEFAULT_SHARED)
  })

  it('cur must be in the curated list', () => {
    expect(decodeState('cur=SEK').currency).toBe('SEK')
    expect(decodeState('cur=USD').currency).toBe('USD')
    expect(decodeState('cur=XYZ').currency).toBeNull()
    expect(decodeState('cur=sek').currency).toBeNull()
    expect(decodeState('cur=').currency).toBeNull()
  })

  it('ignores unknown params but counts our own', () => {
    expect(decodeState('utm_source=x&ref=y').hadParams).toBe(false)
    expect(decodeState('utm_source=x&cur=SEK').hadParams).toBe(true)
    expect(decodeState('utm_source=x&a=claude-opus-5-5,5m,high,kept,1&b=claude-opus-5-5,1h,high,kept,1').setups).toHaveLength(2)
  })
})

describe('decodeState: garbage in, valid state out', () => {
  // A small seeded generator, so a failure is reproducible.
  let seed = 12345
  const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]
  const junk = () => Array.from({ length: Math.floor(rand() * 40) }, () => String.fromCharCode(Math.floor(rand() * 0x2fff))).join('')
  const pieces = ['v', 'a', 'b', 'c', 'd', 'adv', 'cur', 'x', '%', '%ZZ', '=', '&', ',', ',,', 'claude-opus-5-5', 'gpt-5.5', '__proto__', '5m', 'high', '99999999999999999999', '-1', '1e9', 'NaN', 'Infinity']

  it('never throws and always yields 2 to 4 valid setups and sound shared numbers', () => {
    for (let i = 0; i < 400; i++) {
      const q = i % 2 === 0 ? junk() : Array.from({ length: Math.floor(rand() * 14) }, () => pick(pieces)).join(pick(['', '&', '=', ',']))
      const d = decodeState(q)
      expect(d.setups.length).toBeGreaterThanOrEqual(2)
      expect(d.setups.length).toBeLessThanOrEqual(4)
      expect(new Set(d.setups.map((s) => s.id)).size).toBe(d.setups.length)
      for (const s of d.setups) {
        expect(SETUP_IDS).toContain(s.id)
        const spec = MODELS[s.model]
        expect(spec).toBeDefined()
        expect(s.provider).toBe(spec.provider)
        expect(spec.cache.map((c) => c.id)).toContain(s.cache)
        expect(spec.efforts).toContain(s.effort)
        expect(reasoningOptions(spec)).toContain(s.reasoning)
        expect(Number.isInteger(s.interruptions)).toBe(true)
        expect(s.interruptions).toBeGreaterThanOrEqual(0)
        expect(s.interruptions).toBeLessThanOrEqual(50)
      }
      expect(Number.isFinite(d.shared.session)).toBe(true)
      expect(d.shared.base).toBeLessThanOrEqual(d.shared.session)
      expect(Object.values(d.shared.thinking).every((v) => Number.isFinite(v) && v >= 0)).toBe(true)
      // And a valid state always encodes and decodes back to itself.
      expect(roundTrip({ setups: d.setups, shared: d.shared, currency: d.currency ?? 'USD' }).setups).toEqual(d.setups)
    }
  })

  it('handles absurd inputs', () => {
    for (const q of ['?', '??a=', 'a'.repeat(100000), '%'.repeat(5000), '&'.repeat(5000), 'a=' + ','.repeat(50000), '\u0000\u0001', '=&=&=']) {
      expect(() => decodeState(q)).not.toThrow()
      expect(decodeState(q).setups.length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('setup names', () => {
  const named = (s: Setup, name: string): Setup => ({ ...s, name })

  it('are written as na..nd only when set, escaped, and the default state stays a clean "/"', () => {
    expect(encodeState(state(DEFAULT_SETUP_LIST))).toBe('')
    const q = new URLSearchParams(encodeState(state([A, named(B, 'Fast cache')])))
    expect(q.get('nb')).toBe('Fast cache')
    expect(q.has('na')).toBe(false)
    expect(q.get('v')).toBe('1')
  })

  it('a name alone makes the default state non-default', () => {
    const q = encodeState(state(DEFAULT_SETUP_LIST.map((s) => (s.id === 'B' ? named(s, 'Fast cache') : s))))
    expect(new URLSearchParams(q).get('nb')).toBe('Fast cache')
  })

  it('round-trips names with commas, "&", "=", "#", "%", spaces and emoji', () => {
    const names = ['a, b', 'x&y=z', '100% #1 + more', 'Snabb \u{1F680} cache', 'Fast cache']
    const setups = [named(A, names[0]), named(B, names[1]), named(C, names[2]), named(D, names[3])]
    const back = roundTrip(state(setups)).setups
    expect(back).toEqual(setups)
    expect(roundTrip(state([named(A, names[4]), B])).setups).toEqual([named(A, names[4]), B])
  })

  it('the query survives a real URL parse', () => {
    const q = encodeState(state([named(A, 'a, b&c=d \u{1F680}'), B]))
    expect(decodeState(new URL(`https://x.test/?${q}`).search).setups[0].name).toBe('a, b&c=d \u{1F680}')
  })

  it('are cleaned on decode: trimmed, collapsed, stripped, cut, default or blank dropped', () => {
    const d = decodeState(`?v=1&a=${A.model},5m,high,kept,7&b=${B.model},1h,high,kept,7&c=${B.model},5m,high,kept,0&d=${B.model},5m,high,kept,0` +
      `&na=${encodeURIComponent('  too   many \t spaces\u0000 ')}&nb=${'x'.repeat(100)}&nc=Setup%20C&nd=%20%20`)
    expect(d.setups.map((s) => s.name)).toEqual(['too many spaces', 'x'.repeat(40), undefined, undefined])
  })

  it('a name for a setup that is not in the link is ignored', () => {
    const d = decodeState(`?v=1&a=${A.model},5m,high,kept,7&b=${B.model},1h,high,kept,7&nc=Ghost&nd=Ghost2`)
    expect(d.setups.map((s) => s.id)).toEqual(['A', 'B'])
    expect(d.setups.every((s) => s.name === undefined)).toBe(true)
    expect(d.hadParams).toBe(true)
  })

  it('a link with only a name param is not the plain default state', () => {
    const d = decodeState('?nb=Ghost')
    expect(d.hadParams).toBe(true)
    expect(d.setups).toEqual(DEFAULT_SETUP_LIST)
  })

  it('never makes the page lie about colour or order: names only ride on their own id', () => {
    const d = decodeState(`?v=1&b=${B.model},1h,high,kept,7&a=${A.model},5m,high,kept,7&nb=Beta`)
    expect(d.setups.map((s) => [s.id, s.name])).toEqual([['A', undefined], ['B', 'Beta']])
  })
})

describe('xAI models in links', () => {
  const grok = (model: string, extra: Partial<Setup> = {}): Setup => ({ id: 'A', provider: 'xai', model, cache: 'auto', effort: 'high', reasoning: 'dropped', interruptions: 3, ...extra })

  it('round-trips every Grok model id, dots and dashes included, with the provider derived from the model', () => {
    for (const [model, effort, reasoning] of [['grok-4.7', 'xhigh', 'kept'], ['grok-4.6', 'low', 'dropped'], ['grok-4.5', 'medium', 'dropped'], ['grok-4.20-0309-non-reasoning', 'none', 'dropped']] as const) {
      const s = grok(model, { effort, reasoning })
      const q = encodeState(state([s, B]))
      expect(new URLSearchParams(q).get('a')).toBe(`${model},auto,${effort},${reasoning},3`)
      expect(decodeState(`?${q}`).setups[0]).toEqual(s)
    }
  })

  it('a Grok model in a link gets provider xai and valid values: a Claude cache or a missing effort falls back', () => {
    const d = decodeState('?v=1&a=grok-4.5,5m,xhigh,kept,2&b=grok-4.20-0309-non-reasoning,auto,high,kept,0')
    expect(d.setups[0]).toMatchObject({ provider: 'xai', model: 'grok-4.5', cache: 'auto', effort: 'high', reasoning: 'dropped', interruptions: 2 })
    expect(d.setups[1]).toMatchObject({ provider: 'xai', model: 'grok-4.20-0309-non-reasoning', cache: 'auto', effort: 'none', reasoning: 'dropped' })
  })

  it('a Claude or OpenAI cache id is replaced for Grok, and the auto cache is replaced for Claude, as a model switch would', () => {
    expect(decodeState('?v=1&a=grok-4.7,24h,high,kept,1&b=claude-opus-5-5,auto,high,kept,1').setups.map((s) => s.cache)).toEqual(['auto', '5m'])
  })

  it('old links with Claude and OpenAI models are unaffected, and unknown Grok ids are still dropped', () => {
    expect(decodeState('?v=1&a=claude-opus-5-5,5m,high,kept,6&b=gpt-5.6-sol,30m,medium,kept,1').setups.map((s) => s.model)).toEqual(['claude-opus-5-5', 'gpt-5.6-sol'])
    const d = decodeState('?v=1&a=grok-4.3,auto,high,kept,1&b=grok-9,auto,high,kept,1')
    expect(d.setups.map((s) => s.id)).toEqual(['A', 'B'])
    expect(d.setups.every((s) => !s.model.startsWith('grok'))).toBe(true)
  })
})

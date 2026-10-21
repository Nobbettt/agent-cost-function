import { describe, expect, it } from 'vitest'
import { DEFAULT_SHARED } from '../data/defaults'
import { PROTOTYPE_SETUPS } from './prototype-fixtures'
import { MODELS, PROVIDERS, modelsOf, reasoningDefault, reasoningOptions } from '../data/pricing'
import { clampValue, effectiveShared, normalizeSetup, switchModel, switchProvider } from './normalize'
import type { Setup } from './types'

const A = PROTOTYPE_SETUPS.A
const withModel = (setup: Setup, model: string) => ({ ...setup, model, provider: MODELS[model].provider })

describe('normalizeSetup', () => {
  it('keeps cache, effort and reasoning the model allows', () => {
    const s: Setup = { ...A, cache: '1h', effort: 'xhigh', reasoning: 'dropped' }
    expect(normalizeSetup(s, MODELS['claude-sonnet-5-5'])).toEqual(s)
  })

  it('falls back to the first cache option', () => {
    expect(normalizeSetup({ ...A, cache: '1h' }, MODELS['gpt-5.6-sol']).cache).toBe('30m')
  })

  it("falls back to the model's default effort", () => {
    // 'none' is not a Claude effort
    expect(normalizeSetup({ ...A, effort: 'none' }, MODELS['claude-sonnet-5-5']).effort).toBe('high')
    // 'max' is not allowed on gpt-5.4
    expect(normalizeSetup({ ...A, effort: 'max' }, MODELS['gpt-5.4']).effort).toBe('none')
  })

  it("falls back to 'medium' when the model documents no default effort", () => {
    expect(MODELS['gpt-6-astra'].defaultEffort).toBeNull()
    expect(normalizeSetup({ ...A, effort: 'none' }, MODELS['gpt-6-astra']).effort).toBe('medium')
  })

  it('falls back to the first effort when neither wanted nor default is allowed', () => {
    const odd = { ...MODELS['gpt-5.5'], efforts: ['low', 'high'] as const, defaultEffort: null }
    expect(normalizeSetup({ ...A, effort: 'none' }, odd).effort).toBe('low')
  })

  it("falls back to the model's reasoning default", () => {
    expect(normalizeSetup({ ...A, reasoning: 'kept' }, MODELS['gpt-5.5']).reasoning).toBe('dropped')
  })

  it('uses the first allowed reasoning when the documented default is null', () => {
    const sol = MODELS['gpt-6.1-sol']
    expect(reasoningDefault(sol)).toBeNull()
    expect(reasoningOptions(sol)).toEqual(['kept', 'dropped'])
    expect(normalizeSetup({ ...A, reasoning: 'dropped' }, sol).reasoning).toBe('dropped')
    expect(normalizeSetup({ ...A, reasoning: 'kept' }, sol).reasoning).toBe('kept')
  })

  it('does not mutate its input', () => {
    const s = Object.freeze({ ...A, cache: '1h' as const })
    expect(() => normalizeSetup(s, MODELS['gpt-5.5'])).not.toThrow()
    expect(s.cache).toBe('1h')
  })
})

describe('switchModel', () => {
  it('keeps current values the new model allows', () => {
    const s: Setup = { ...A, cache: '1h', effort: 'low', reasoning: 'dropped' }
    expect(switchModel(s, 'claude-haiku-5-5')).toEqual({ ...s, model: 'claude-haiku-5-5' })
  })

  it('falls back where the new model disallows them', () => {
    const s = withModel({ ...A, effort: 'none', cache: '24h', reasoning: 'kept' }, 'gpt-5.5')
    expect(switchModel(s, 'gpt-5.6-sol')).toMatchObject({ model: 'gpt-5.6-sol', cache: '30m', effort: 'none', reasoning: 'kept' })
    expect(switchModel(s, 'gpt-5.4')).toMatchObject({ cache: '24h', effort: 'none', reasoning: 'dropped' })
  })
})

describe('switchProvider', () => {
  it("selects the provider's default model and resets to its defaults", () => {
    const s: Setup = { ...A, cache: '1h', effort: 'low', reasoning: 'dropped', interruptions: 7 }
    expect(switchProvider(s, 'openai')).toEqual({
      ...s, provider: 'openai', model: 'gpt-5.6-sol', cache: '30m', effort: 'medium', reasoning: 'kept',
    })
    expect(switchProvider({ ...PROTOTYPE_SETUPS.B, effort: 'none' }, 'claude')).toMatchObject({
      provider: 'claude', model: 'claude-opus-5-5', cache: '5m', effort: 'medium', reasoning: 'kept',
    })
  })

  it('xAI: the default model with its automatic cache, high effort and kept reasoning', () => {
    expect(switchProvider(A, 'xai')).toMatchObject({ provider: 'xai', model: 'grok-4.7', cache: 'auto', effort: 'high', reasoning: 'kept' })
  })

  it('every provider default model belongs to that provider', () => {
    for (const [p, v] of Object.entries(PROVIDERS)) expect(MODELS[v.defaultModel].provider).toBe(p)
    expect(modelsOf('claude').every(([, m]) => m.provider === 'claude')).toBe(true)
  })
})

describe('clampValue', () => {
  it('clamps to min and max', () => {
    expect(clampValue('5', 10000, 1e6, 7)).toBe(10000)
    expect(clampValue('2e6', 10000, 1e6, 7)).toBe(1e6)
    expect(clampValue('50000', 10000, 1e6, 7)).toBe(50000)
  })

  it('falls back when empty or not a number', () => {
    expect(clampValue('', 0, 10, 3)).toBe(3)
    expect(clampValue('abc', 0, 10, 3)).toBe(3)
    expect(clampValue('Infinity', 0, 10, 3)).toBe(3)
  })
})

describe('effectiveShared', () => {
  it('caps base at the session length without mutating', () => {
    const shared = Object.freeze({ ...DEFAULT_SHARED, session: 10000, base: 20000 })
    expect(effectiveShared(shared).base).toBe(10000)
    expect(shared.base).toBe(20000)
    expect(effectiveShared(DEFAULT_SHARED)).toEqual(DEFAULT_SHARED)
  })
})

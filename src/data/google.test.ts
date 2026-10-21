import { describe, expect, it } from 'vitest'
import { fmtTokens } from '../format'
import { switchModel, switchProvider } from '../model/normalize'
import { PROTOTYPE_SETUPS } from '../model/prototype-fixtures'
import { DOCS, MODELS, PROVIDERS, googlePage, modelsOf, reasoningDefault, reasoningOptions } from './pricing'

const GEMINI = ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview']
const A = PROTOTYPE_SETUPS.A

describe('Google models', () => {
  it('are the five documented ones, after the xAI models, with Gemini 3.8 Flash as the provider default', () => {
    expect(modelsOf('google').map(([id]) => id)).toEqual(GEMINI)
    const order = Object.keys(MODELS)
    expect(order.indexOf('gemini-4-argon')).toBe(order.indexOf('grok-4.20-0309-non-reasoning') + 1)
    expect(PROVIDERS.google).toEqual({ name: 'Google', defaultModel: 'gemini-3.8-flash', sources: ['googlePricing', 'googleModels', 'googleCaching', 'googleThinking'] })
    for (const excluded of ['gemini-2.5-pro', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite']) expect(MODELS[excluded]).toBeUndefined()
  })

  it('have the current paid prices (USD per 1M tokens), read multipliers and the 1,048,576 limit', () => {
    const row = (id: string) => { const m = MODELS[id]; return [m.name, m.in, +(m.in * m.read).toFixed(4), m.out, m.maxInput] }
    expect(row('gemini-4-argon')).toEqual(['Gemini 4 Argon', 2, 0.1, 10, 1048576])
    expect(row('gemini-3.8-flash')).toEqual(['Gemini 3.8 Flash', 0.75, 0.075, 3.75, 1048576])
    expect(row('gemini-3.6-flash')).toEqual(['Gemini 3.6 Flash', 0.75, 0.075, 3.75, 1048576])
    expect(row('gemini-3.5-flash-lite')).toEqual(['Gemini 3.5 Flash-Lite', 0.3, 0.03, 2.5, 1048576])
    expect(row('gemini-3.1-pro-preview')).toEqual(['Gemini 3.1 Pro Preview', 2, 0.2, 12, 1048576])
    expect(MODELS['gemini-4-argon'].read).toBe(0.05)
    for (const id of GEMINI.slice(1)) expect(MODELS[id].read).toBe(0.1)
    expect(fmtTokens(1048576)).toBe('1.05M')
  })

  it('only 3.1 Pro has a long-prompt rule (above 200K, exclusive)', () => {
    expect(MODELS['gemini-3.1-pro-preview'].longPrompt).toEqual({ above: 200000, inMult: 2, outMult: 1.5 })
    for (const id of GEMINI.filter((g) => g !== 'gemini-3.1-pro-preview')) expect(MODELS[id].longPrompt).toBeUndefined()
  })

  it('have one implicit cache option with no write fee, distinct from the xAI one', () => {
    for (const id of GEMINI) expect(MODELS[id].cache).toEqual([{ id: 'implicit', label: 'implicit · no write fee', minutes: 0, write: 1 }])
    expect(MODELS['grok-4.7'].cache[0].id).toBe('auto')
  })

  it('offer low, medium and high (no minimal), with the documented defaults and none marked for Flash-Lite', () => {
    for (const id of GEMINI) expect(MODELS[id].efforts).toEqual(['low', 'medium', 'high'])
    expect(GEMINI.map((id) => MODELS[id].defaultEffort)).toEqual(['medium', 'medium', 'medium', null, 'high'])
    expect(MODELS['gemini-3.5-flash-lite'].fallbackEffort).toBe('low')
  })

  it('keep earlier reasoning in context, and that is the default', () => {
    for (const id of GEMINI) {
      expect(reasoningOptions(MODELS[id])).toEqual(['kept'])
      expect(reasoningDefault(MODELS[id])).toBe('kept')
    }
  })

  it('link each model to its own page, and the docs entries to the four Google pages', () => {
    expect(googlePage('gemini-3.8-flash')).toBe('https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash')
    expect(DOCS.googlePricing.url).toBe('https://ai.google.dev/gemini-api/docs/pricing')
    expect(DOCS.googleModels.url).toBe('https://ai.google.dev/gemini-api/docs/models')
    expect(DOCS.googleCaching.url).toBe('https://ai.google.dev/gemini-api/docs/caching')
    expect(DOCS.googleThinking.url).toBe('https://ai.google.dev/gemini-api/docs/thinking')
  })
})

describe('switching to and between Google models', () => {
  it('the provider switch selects Gemini 3.8 Flash, implicit cache, medium effort, kept reasoning', () => {
    expect(switchProvider(A, 'google')).toEqual({ ...A, provider: 'google', model: 'gemini-3.8-flash', cache: 'implicit', effort: 'medium', reasoning: 'kept' })
  })

  it('a model switch keeps what the model allows and falls back otherwise', () => {
    const g = { ...switchProvider(A, 'google'), effort: 'high' as const }
    expect(switchModel(g, 'gemini-3.1-pro-preview')).toMatchObject({ effort: 'high', cache: 'implicit', reasoning: 'kept' })
    expect(switchModel({ ...g, effort: 'xhigh' }, 'gemini-3.1-pro-preview').effort).toBe('high')
    expect(switchModel({ ...A, cache: '1h', reasoning: 'dropped' }, 'gemini-4-argon')).toMatchObject({ cache: 'implicit', reasoning: 'kept', effort: 'high' })
    expect(switchModel({ ...A, effort: 'xhigh' }, 'gemini-3.5-flash-lite').effort).toBe('low')
  })
})

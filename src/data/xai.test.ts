import { describe, expect, it } from 'vitest'
import { fmtTokens } from '../format'
import { switchModel, switchProvider } from '../model/normalize'
import { PROTOTYPE_SETUPS } from '../model/prototype-fixtures'
import { DOCS, MODELS, PROVIDERS, modelsOf, reasoningDefault, reasoningOptions } from './pricing'

const GROK = ['grok-4.7', 'grok-4.6', 'grok-4.5', 'grok-4.20-0309-non-reasoning']
const A = PROTOTYPE_SETUPS.A

describe('xAI models', () => {
  it('are exactly the four documented ones, after the OpenAI models', () => {
    expect(modelsOf('xai').map(([id]) => id)).toEqual(GROK)
    const order = Object.keys(MODELS)
    expect(order.indexOf('grok-4.7')).toBe(order.indexOf('gpt-5.4-mini') + 1)
    expect(PROVIDERS.xai).toEqual({ name: 'xAI', defaultModel: 'grok-4.7', sources: ['xaiPricing', 'xaiCaching', 'xaiReasoning'] })
    expect(Object.keys(PROVIDERS)).toEqual(['claude', 'openai', 'xai', 'google'])
    for (const excluded of ['grok-4.3', 'grok-4.20-0309-reasoning', 'grok-4.20-multi-agent', 'grok-build-0.1']) expect(MODELS[excluded]).toBeUndefined()
  })

  it('have the documented prices, context sizes and read multipliers (cached input divided by input)', () => {
    const row = (id: string) => { const m = MODELS[id]; return [m.name, m.in, m.in * m.read, m.out, m.maxInput] }
    expect(row('grok-4.7')).toEqual(['Grok 4.7', 2, 0.5, 6, 500000])
    expect(row('grok-4.6')).toEqual(['Grok 4.6', 2, 0.5, 6, 500000])
    expect(row('grok-4.5')[2]).toBeCloseTo(0.3, 12)
    expect(row('grok-4.5').filter((_, i) => i !== 2)).toEqual(['Grok 4.5', 2, 6, 500000])
    expect(row('grok-4.20-0309-non-reasoning')[2]).toBeCloseTo(0.2, 12)
    expect(row('grok-4.20-0309-non-reasoning').filter((_, i) => i !== 2)).toEqual(['Grok 4.20 (non-reasoning)', 1.25, 2.5, 1e6])
    expect(MODELS['grok-4.7'].read).toBe(0.25)
    expect(MODELS['grok-4.5'].read).toBe(0.15)
    expect(MODELS['grok-4.20-0309-non-reasoning'].read).toBe(0.16)
  })

  it('bill the whole request at 2x once the prompt reaches 200K tokens (inclusive)', () => {
    for (const id of GROK) expect(MODELS[id].longPrompt).toEqual({ above: 200000, inclusive: true, inMult: 2, outMult: 2 })
  })

  it('have one automatic cache option with no write fee and no lifetime', () => {
    for (const id of GROK) expect(MODELS[id].cache).toEqual([{ id: 'auto', label: 'best-effort · no write fee', minutes: 0, write: 1 }])
  })

  it('support the documented reasoning efforts and defaults', () => {
    expect(MODELS['grok-4.7'].efforts).toEqual(['low', 'medium', 'high', 'xhigh'])
    expect(MODELS['grok-4.6'].efforts).toEqual(['low', 'medium', 'high', 'xhigh'])
    expect(MODELS['grok-4.5'].efforts).toEqual(['low', 'medium', 'high'])
    expect(MODELS['grok-4.20-0309-non-reasoning'].efforts).toEqual(['none'])
    expect(['grok-4.7', 'grok-4.6', 'grok-4.5'].map((id) => MODELS[id].defaultEffort)).toEqual(['high', 'high', 'high'])
    expect(MODELS['grok-4.20-0309-non-reasoning'].defaultEffort).toBeNull()
  })

  it('can keep earlier reasoning only on grok-4.7, with no documented default', () => {
    expect(reasoningOptions(MODELS['grok-4.7'])).toEqual(['kept', 'dropped'])
    expect(reasoningDefault(MODELS['grok-4.7'])).toBeNull()
    for (const id of GROK.slice(1)) expect(reasoningOptions(MODELS[id])).toEqual(['dropped'])
  })

  it('have docs entries with the right links', () => {
    expect(DOCS.xaiPricing.url).toBe('https://docs.x.ai/docs/models')
    expect(DOCS.xaiCaching.url).toBe('https://docs.x.ai/developers/advanced-api-usage/prompt-caching/how-it-works')
    expect(DOCS.xaiReasoning.url).toBe('https://docs.x.ai/docs/guides/reasoning')
    expect(fmtTokens(MODELS['grok-4.7'].maxInput)).toBe('500K')
  })
})

describe('switching to and between xAI models', () => {
  it('the provider switch selects grok-4.7 with the auto cache, high effort and kept reasoning', () => {
    expect(switchProvider(A, 'xai')).toEqual({ ...A, provider: 'xai', model: 'grok-4.7', cache: 'auto', effort: 'high', reasoning: 'kept' })
  })

  it('switching back to Claude restores Opus 5.5 defaults', () => {
    const grok = switchProvider({ ...A, interruptions: 3 }, 'xai')
    expect(switchProvider(grok, 'claude')).toEqual({ ...A, interruptions: 3, provider: 'claude', model: 'claude-opus-5-5', cache: '5m', effort: 'medium', reasoning: 'kept' })
  })

  it('a model switch keeps what the model allows and falls back otherwise', () => {
    const g47 = { ...switchProvider(A, 'xai'), effort: 'xhigh' as const }
    expect(switchModel(g47, 'grok-4.6')).toMatchObject({ effort: 'xhigh', cache: 'auto', reasoning: 'dropped' })
    expect(switchModel(g47, 'grok-4.5').effort).toBe('high')
    expect(switchModel(g47, 'grok-4.20-0309-non-reasoning')).toMatchObject({ effort: 'none', cache: 'auto', reasoning: 'dropped' })
    expect(switchModel({ ...A, cache: '1h' }, 'grok-4.7').cache).toBe('auto')
  })
})

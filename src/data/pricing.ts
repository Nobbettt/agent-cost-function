import type { CacheOption, Effort, ModelId, ModelSpec, Provider, ReasoningMode } from '../model/types'

/** Date the prices and settings below were last checked against the docs. */
export const PRICES_CHECKED = '2026-10-20'

export const DOCS = {
  claudePricing: { url: 'https://platform.claude.com/docs/en/about-claude/pricing', proves: 'Claude input, cache write (5 min 1.25×, 1 h 2×), cache read and output prices; Haiku 5.5 over-100K prices' },
  claudeModels: { url: 'https://platform.claude.com/docs/en/about-claude/models/overview', proves: 'Claude context windows and default effort' },
  claudeEffort: { url: 'https://platform.claude.com/docs/en/build-with-claude/effort', proves: 'Which Claude models support which effort levels' },
  claudeThinking: { url: 'https://platform.claude.com/docs/en/build-with-claude/thinking', proves: 'Thinking billed as output; which models keep earlier thinking in context; dropping it with the clear_thinking_20251015 context-editing strategy' },
  openaiPricing: { url: 'https://developers.openai.com/api/docs/pricing', proves: 'OpenAI input, cached input, cache write, output and over-272K prices' },
  openaiCaching: { url: 'https://developers.openai.com/api/docs/guides/prompt-caching', proves: 'OpenAI cache lifetimes (30m; in_memory; 24h), write 1.25× on GPT-5.6 and later, no write fee before' },
  openaiReasoning: { url: 'https://developers.openai.com/api/docs/guides/reasoning', proves: 'Reasoning billed as output; reasoning.context default per model family' },
  xaiPricing: { url: 'https://docs.x.ai/docs/models', proves: 'xAI input, cached input and output prices, context windows, and 2× prices for prompts that reach 200K tokens (checked 2026-10-21)' },
  xaiCaching: { url: 'https://docs.x.ai/developers/advanced-api-usage/prompt-caching/how-it-works', proves: 'xAI caches prefixes automatically: no lifetime is stated or settable, entries can be evicted at any time, and no cache write fee is documented' },
  xaiReasoning: { url: 'https://docs.x.ai/docs/guides/reasoning', proves: 'Which xAI models support which reasoning_effort levels; reasoning tokens billed as part of total consumption (no rate is stated, so the output rate is assumed); carrying reasoning across turns on grok-4.7' },
  googlePricing: { url: 'https://ai.google.dev/gemini-api/docs/pricing', proves: 'Gemini input, cached input and output prices (thinking included in output), scheduled price increases, and 2× / 1.5× prices above 200K tokens on Gemini 3.1 Pro Preview (page updated 2026-10-19)' },
  googleModels: { url: 'https://ai.google.dev/gemini-api/docs/models', proves: 'Gemini model list and input token limits (each model page lists its own limit)' },
  googleCaching: { url: 'https://ai.google.dev/gemini-api/docs/caching', proves: 'Gemini implicit caching: on by default, automatic, no savings guarantee, no lifetime stated, no write or storage fee; explicit caching (generateContent only, not for Gemini 4 Argon): TTL defaults to 1 hour, storage billed per hour, cost saving guarantee' },
  googleThinking: { url: 'https://ai.google.dev/gemini-api/docs/thinking', proves: 'Gemini thinking levels per model and their defaults; thinking tokens billed with output; thought blocks resent on later turns' },
  frankfurter: { url: 'https://frankfurter.dev', proves: 'Exchange rates for the display currency (ECB reference rates, daily)' },
} as const

/**
 * The model with the prices in force on `date` (YYYY-MM-DD): the latest scheduled change whose date is on or before
 * it, else the base prices. Limits and the long-prompt rule never change. No date means the base prices.
 */
export function priceOn(model: ModelSpec, date?: string): ModelSpec {
  const due = date === undefined ? undefined : model.schedule?.filter((c) => c.from <= date).at(-1)
  return due
    ? { ...model, in: due.in, out: due.out, read: due.read ?? model.read, ...(model.explicitStorage === undefined ? {} : { explicitStorage: due.storage ?? model.explicitStorage }) }
    : model
}

/** One announced change, with every model it applies to (models with the same date and prices are grouped). */
export interface UpcomingChange { from: string; models: string[]; in: number; cached: number; out: number; storage?: number }

/** The scheduled changes dated after `today`, earliest first. Once a date has passed its change is gone from here. */
export function upcomingChanges(today: string): UpcomingChange[] {
  const groups = new Map<string, UpcomingChange>()
  for (const model of Object.values(MODELS)) {
    for (const c of model.schedule ?? []) {
      if (c.from <= today) continue
      const cached = +(c.in * (c.read ?? model.read)).toFixed(6)
      const key = `${c.from}|${c.in}|${cached}|${c.out}|${c.storage ?? ''}`
      const group = groups.get(key) ?? { from: c.from, models: [], in: c.in, cached, out: c.out, ...(c.storage === undefined ? {} : { storage: c.storage }) }
      group.models.push(model.name)
      groups.set(key, group)
    }
  }
  return [...groups.values()].sort((a, b) => a.from.localeCompare(b.from))
}

export const googlePage = (id: ModelId) => `https://ai.google.dev/gemini-api/docs/models/${id}`
export const openaiPage = (id: ModelId) => `https://developers.openai.com/api/docs/models/${id}`

const CLAUDE_CACHE: readonly CacheOption[] = [
  { id: '5m', label: '5 min · write 1.25×', minutes: 5, write: 1.25 },
  { id: '1h', label: '1 hour · write 2×', minutes: 60, write: 2 },
]
// xAI: automatic prefix caching, no stated lifetime and no documented write fee. A cache break re-reads the context at the full input price.
const XAI_CACHE: readonly CacheOption[] = [{ id: 'auto', label: 'best-effort · no write fee', minutes: 0, write: 1 }]
// Google: implicit caching is on by default and automatic: no stated lifetime, no write or storage fee, no guarantee of savings.
// Gemini 3.x can also keep the fixed prompt in an explicit cache (`explicitStorage`: an hourly storage fee); Argon cannot.
const GOOGLE_CACHE: readonly CacheOption[] = [{ id: 'implicit', label: 'implicit · no write fee', minutes: 0, write: 1 }]
const OPENAI_30M: CacheOption = { id: '30m', label: '30 min · write 1.25×', minutes: 30, write: 1.25 }
const OPENAI_24H: CacheOption = { id: '24h', label: '24h', minutes: 30, write: 1 }
const OPENAI_IN_MEMORY: CacheOption = { id: 'in_memory', label: 'in_memory', minutes: 5, write: 1 }

export const ALL_EFFORTS: readonly Effort[] = ['none', 'low', 'medium', 'high', 'xhigh', 'max']
const LOW_TO_MAX: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']
const NONE_TO_MAX: readonly Effort[] = ['none', ...LOW_TO_MAX]
const NONE_TO_XHIGH: readonly Effort[] = ['none', 'low', 'medium', 'high', 'xhigh']
const LOW_TO_XHIGH: readonly Effort[] = ['low', 'medium', 'high', 'xhigh']
const LOW_TO_HIGH: readonly Effort[] = ['low', 'medium', 'high']
const GOOGLE_LONG = { above: 200000, inMult: 2, outMult: 1.5 }
const FLASH_RISE = { from: '2027-01-01', in: 1.5, out: 7.5, storage: 1 } // Gemini 3.8 and 3.6 Flash
const OPENAI_LONG = { above: 272000, inMult: 2, outMult: 1.5 }
// xAI bills the whole request at 2× once its prompt reaches 200K tokens (inclusive, unlike OpenAI's "above 272K").
const XAI_LONG = { above: 200000, inclusive: true, inMult: 2, outMult: 2 }

const KD: readonly ReasoningMode[] = ['kept', 'dropped']
const DROPPED: readonly ReasoningMode[] = ['dropped']

export const MODELS: Readonly<Record<ModelId, ModelSpec>> = {
  'claude-fable-5-1':  { provider: 'claude', name: 'Fable 5.1',  in: 10,   out: 50,  read: 0.025, maxInput: 1e6, efforts: LOW_TO_MAX, defaultEffort: 'high',   cache: CLAUDE_CACHE, reasoning: KD },
  'claude-opus-5-5':   { provider: 'claude', name: 'Opus 5.5',   in: 4,    out: 20,  read: 0.05,  maxInput: 1e6, efforts: LOW_TO_MAX, defaultEffort: 'medium', cache: CLAUDE_CACHE, reasoning: KD },
  'claude-sonnet-5-5': { provider: 'claude', name: 'Sonnet 5.5', in: 2,    out: 10,  read: 0.05,  maxInput: 1e6, efforts: LOW_TO_MAX, defaultEffort: 'high',   cache: CLAUDE_CACHE, reasoning: KD },
  'claude-haiku-5-5':  { provider: 'claude', name: 'Haiku 5.5',  in: 0.1,  out: 0.5, read: 0.1,   maxInput: 1e6, efforts: LOW_TO_MAX, defaultEffort: 'medium', cache: CLAUDE_CACHE, reasoning: KD,
                         longPrompt: { above: 100000, inMult: 5, outMult: 5 } },
  'claude-opus-5':     { provider: 'claude', name: 'Opus 5',     in: 5,    out: 25,  read: 0.1,   maxInput: 1e6, efforts: LOW_TO_MAX, defaultEffort: 'high',   cache: CLAUDE_CACHE, reasoning: KD },
  'claude-opus-4-8':   { provider: 'claude', name: 'Opus 4.8',   in: 5,    out: 25,  read: 0.1,   maxInput: 1e6, efforts: LOW_TO_MAX, defaultEffort: 'high',   cache: CLAUDE_CACHE, reasoning: KD },
  'claude-sonnet-5':   { provider: 'claude', name: 'Sonnet 5',   in: 2,    out: 10,  read: 0.1,   maxInput: 1e6, efforts: LOW_TO_MAX, defaultEffort: 'high',   cache: CLAUDE_CACHE, reasoning: KD },
  'claude-sonnet-4-6': { provider: 'claude', name: 'Sonnet 4.6', in: 3,    out: 15,  read: 0.1,   maxInput: 1e6, efforts: ['low', 'medium', 'high', 'max'], defaultEffort: 'high', cache: CLAUDE_CACHE, reasoning: KD },
  'gpt-6-astra':       { provider: 'openai', name: 'GPT-6 Astra',       in: 10,   out: 50,  read: 0.1,   maxInput: 922000,  efforts: LOW_TO_MAX,    defaultEffort: null,     cache: [OPENAI_30M], reasoning: DROPPED, longPrompt: OPENAI_LONG },
  'gpt-6.1-sol':       { provider: 'openai', name: 'GPT-6.1 Sol',       in: 2,    out: 10,  read: 0.05,  maxInput: 922000,  efforts: LOW_TO_MAX,    defaultEffort: 'medium', cache: [OPENAI_30M], reasoning: [null, 'kept', 'dropped'], longPrompt: OPENAI_LONG },
  'gpt-6-sol':         { provider: 'openai', name: 'GPT-6 Sol',         in: 2,    out: 10,  read: 0.1,   maxInput: 1050000, efforts: NONE_TO_MAX,   defaultEffort: 'medium', cache: [OPENAI_30M], reasoning: DROPPED, longPrompt: OPENAI_LONG },
  'gpt-6-luna':        { provider: 'openai', name: 'GPT-6 Luna',        in: 0.1,  out: 0.5, read: 0.1,   maxInput: 1050000, efforts: NONE_TO_MAX,   defaultEffort: 'medium', cache: [OPENAI_30M], reasoning: DROPPED, longPrompt: OPENAI_LONG },
  'gpt-5.6-sol':       { provider: 'openai', name: 'GPT-5.6 Sol',       in: 4,    out: 20,  read: 0.1,   maxInput: 922000,  efforts: NONE_TO_MAX,   defaultEffort: 'medium', cache: [OPENAI_30M], reasoning: KD, longPrompt: OPENAI_LONG },
  'gpt-5.6-terra':     { provider: 'openai', name: 'GPT-5.6 Terra',     in: 2,    out: 12,  read: 0.1,   maxInput: 922000,  efforts: NONE_TO_MAX,   defaultEffort: 'medium', cache: [OPENAI_30M], reasoning: KD, longPrompt: OPENAI_LONG },
  'gpt-5.6-luna':      { provider: 'openai', name: 'GPT-5.6 Luna',      in: 0.2,  out: 1.2, read: 0.1,   maxInput: 922000,  efforts: NONE_TO_MAX,   defaultEffort: 'medium', cache: [OPENAI_30M], reasoning: KD, longPrompt: OPENAI_LONG },
  'gpt-5.5':           { provider: 'openai', name: 'GPT-5.5',           in: 5,    out: 30,  read: 0.1,   maxInput: 1050000, efforts: NONE_TO_XHIGH, defaultEffort: 'medium', cache: [OPENAI_24H], reasoning: DROPPED, longPrompt: OPENAI_LONG },
  'gpt-5.4':           { provider: 'openai', name: 'GPT-5.4',           in: 2.5,  out: 15,  read: 0.1,   maxInput: 1050000, efforts: NONE_TO_XHIGH, defaultEffort: 'none',   cache: [OPENAI_24H, OPENAI_IN_MEMORY], reasoning: DROPPED, longPrompt: OPENAI_LONG },
  'gpt-5.4-mini':      { provider: 'openai', name: 'GPT-5.4 mini',      in: 0.75, out: 4.5, read: 0.1,   maxInput: 272000,  efforts: NONE_TO_XHIGH, defaultEffort: 'none',   cache: [OPENAI_IN_MEMORY], reasoning: DROPPED },
  'grok-4.7':          { provider: 'xai', name: 'Grok 4.7',  in: 2, out: 6, read: 0.25, maxInput: 500000, efforts: LOW_TO_XHIGH, defaultEffort: 'high', cache: XAI_CACHE, reasoning: [null, 'kept', 'dropped'], longPrompt: XAI_LONG },
  'grok-4.6':          { provider: 'xai', name: 'Grok 4.6',  in: 2, out: 6, read: 0.25, maxInput: 500000, efforts: LOW_TO_XHIGH, defaultEffort: 'high', cache: XAI_CACHE, reasoning: DROPPED, longPrompt: XAI_LONG },
  'grok-4.5':          { provider: 'xai', name: 'Grok 4.5',  in: 2, out: 6, read: 0.15, maxInput: 500000, efforts: LOW_TO_HIGH, defaultEffort: 'high', cache: XAI_CACHE, reasoning: DROPPED, longPrompt: XAI_LONG },
  'grok-4.20-0309-non-reasoning': { provider: 'xai', name: 'Grok 4.20 (non-reasoning)', in: 1.25, out: 2.5, read: 0.16, maxInput: 1e6, efforts: ['none'], defaultEffort: null, cache: XAI_CACHE, reasoning: DROPPED, longPrompt: XAI_LONG },
  'gemini-4-argon':        { provider: 'google', name: 'Gemini 4 Argon',         in: 2,    out: 10,   read: 0.05, maxInput: 1048576, efforts: LOW_TO_HIGH, defaultEffort: 'medium', cache: GOOGLE_CACHE, reasoning: ['kept'], schedule: [{ from: '2026-12-01', in: 4, out: 20 }] },
  'gemini-3.8-flash':      { provider: 'google', name: 'Gemini 3.8 Flash',       in: 0.75, out: 3.75, read: 0.1,  maxInput: 1048576, efforts: LOW_TO_HIGH, defaultEffort: 'medium', cache: GOOGLE_CACHE, reasoning: ['kept'], explicitStorage: 0.5, schedule: [FLASH_RISE] },
  'gemini-3.6-flash':      { provider: 'google', name: 'Gemini 3.6 Flash',       in: 0.75, out: 3.75, read: 0.1,  maxInput: 1048576, efforts: LOW_TO_HIGH, defaultEffort: 'medium', cache: GOOGLE_CACHE, reasoning: ['kept'], explicitStorage: 0.5, schedule: [FLASH_RISE] },
  'gemini-3.5-flash-lite': { provider: 'google', name: 'Gemini 3.5 Flash-Lite',  in: 0.3,  out: 2.5,  read: 0.1,  maxInput: 1048576, efforts: LOW_TO_HIGH, defaultEffort: null, fallbackEffort: 'low', cache: GOOGLE_CACHE, reasoning: ['kept'], explicitStorage: 1 },
  'gemini-3.1-pro-preview': { provider: 'google', name: 'Gemini 3.1 Pro Preview', in: 2,    out: 12,   read: 0.1,  maxInput: 1048576, efforts: LOW_TO_HIGH, defaultEffort: 'high', cache: GOOGLE_CACHE, reasoning: ['kept'], explicitStorage: 4.5, longPrompt: GOOGLE_LONG },
}

export const PROVIDERS: Readonly<Record<Provider, { name: string; defaultModel: ModelId; sources: readonly (keyof typeof DOCS)[] }>> = {
  claude: { name: 'Claude', defaultModel: 'claude-opus-5-5', sources: ['claudePricing', 'claudeModels', 'claudeEffort', 'claudeThinking'] },
  openai: { name: 'OpenAI', defaultModel: 'gpt-5.6-sol', sources: ['openaiPricing', 'openaiCaching', 'openaiReasoning'] },
  xai: { name: 'xAI', defaultModel: 'grok-4.7', sources: ['xaiPricing', 'xaiCaching', 'xaiReasoning'] },
  google: { name: 'Google', defaultModel: 'gemini-3.8-flash', sources: ['googlePricing', 'googleModels', 'googleCaching', 'googleThinking'] },
}

/** Models of one provider, in table order. */
export const modelsOf = (provider: Provider): [ModelId, ModelSpec][] =>
  Object.entries(MODELS).filter(([, m]) => m.provider === provider)

export const reasoningOptions = (m: ModelSpec): ReasoningMode[] =>
  m.reasoning.filter((r): r is ReasoningMode => r !== null)
export const reasoningDefault = (m: ModelSpec): ReasoningMode | null => m.reasoning[0] ?? null

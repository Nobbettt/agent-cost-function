import type { CacheOption, Effort, ModelId, ModelSpec, Provider, ReasoningMode } from '../model/types'

// Prices verified 2026-10-20 against the docs below.
export const DOCS = {
  claudePricing: { url: 'https://platform.claude.com/docs/en/about-claude/pricing', proves: 'Claude input, cache write (5 min 1.25×, 1 h 2×), cache read and output prices; Haiku 5.5 over-100K prices' },
  claudeModels: { url: 'https://platform.claude.com/docs/en/about-claude/models/overview', proves: 'Claude context windows and default effort' },
  claudeEffort: { url: 'https://platform.claude.com/docs/en/build-with-claude/effort', proves: 'Which Claude models support which effort levels' },
  claudeThinking: { url: 'https://platform.claude.com/docs/en/build-with-claude/thinking', proves: 'Thinking billed as output; which models keep earlier thinking in context; dropping it with the clear_thinking_20251015 context-editing strategy' },
  openaiPricing: { url: 'https://developers.openai.com/api/docs/pricing', proves: 'OpenAI input, cached input, cache write, output and over-272K prices' },
  openaiCaching: { url: 'https://developers.openai.com/api/docs/guides/prompt-caching', proves: 'OpenAI cache lifetimes (30m; in_memory; 24h), write 1.25× on GPT-5.6 and later, no write fee before' },
  openaiReasoning: { url: 'https://developers.openai.com/api/docs/guides/reasoning', proves: 'Reasoning billed as output; reasoning.context default per model family' },
} as const

export const openaiPage = (id: ModelId) => `https://developers.openai.com/api/docs/models/${id}`

const CLAUDE_CACHE: readonly CacheOption[] = [
  { id: '5m', label: '5 min · write 1.25×', minutes: 5, write: 1.25 },
  { id: '1h', label: '1 hour · write 2×', minutes: 60, write: 2 },
]
const OPENAI_30M: CacheOption = { id: '30m', label: '30 min · write 1.25×', minutes: 30, write: 1.25 }
const OPENAI_24H: CacheOption = { id: '24h', label: '24h · ~30 min typical · no write fee', minutes: 30, write: 1 }
const OPENAI_IN_MEMORY: CacheOption = { id: 'in_memory', label: 'in_memory · ~5–10 min · no write fee', minutes: 5, write: 1 }

export const ALL_EFFORTS: readonly Effort[] = ['none', 'low', 'medium', 'high', 'xhigh', 'max']
const LOW_TO_MAX: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']
const NONE_TO_MAX: readonly Effort[] = ['none', ...LOW_TO_MAX]
const NONE_TO_XHIGH: readonly Effort[] = ['none', 'low', 'medium', 'high', 'xhigh']
const OPENAI_LONG = { above: 272000, inMult: 2, outMult: 1.5 }

const KD: readonly ReasoningMode[] = ['kept', 'dropped']
const DROPPED: readonly ReasoningMode[] = ['dropped']

export const MODELS: Readonly<Record<ModelId, ModelSpec>> = {
  'claude-fable-5-1':  { provider: 'claude', name: 'Claude Fable 5.1',  in: 10,   out: 50,  read: 0.025, maxInput: 1e6, efforts: LOW_TO_MAX, defaultEffort: 'high',   cache: CLAUDE_CACHE, reasoning: KD },
  'claude-opus-5-5':   { provider: 'claude', name: 'Claude Opus 5.5',   in: 4,    out: 20,  read: 0.05,  maxInput: 1e6, efforts: LOW_TO_MAX, defaultEffort: 'medium', cache: CLAUDE_CACHE, reasoning: KD },
  'claude-sonnet-5-5': { provider: 'claude', name: 'Claude Sonnet 5.5', in: 2,    out: 10,  read: 0.05,  maxInput: 1e6, efforts: LOW_TO_MAX, defaultEffort: 'high',   cache: CLAUDE_CACHE, reasoning: KD },
  'claude-haiku-5-5':  { provider: 'claude', name: 'Claude Haiku 5.5',  in: 0.1,  out: 0.5, read: 0.1,   maxInput: 1e6, efforts: LOW_TO_MAX, defaultEffort: 'medium', cache: CLAUDE_CACHE, reasoning: KD,
                         longPrompt: { above: 100000, inMult: 5, outMult: 5 } },
  'claude-opus-5':     { provider: 'claude', name: 'Claude Opus 5',     in: 5,    out: 25,  read: 0.1,   maxInput: 1e6, efforts: LOW_TO_MAX, defaultEffort: 'high',   cache: CLAUDE_CACHE, reasoning: KD },
  'claude-opus-4-8':   { provider: 'claude', name: 'Claude Opus 4.8',   in: 5,    out: 25,  read: 0.1,   maxInput: 1e6, efforts: LOW_TO_MAX, defaultEffort: 'high',   cache: CLAUDE_CACHE, reasoning: KD },
  'claude-sonnet-5':   { provider: 'claude', name: 'Claude Sonnet 5',   in: 2,    out: 10,  read: 0.1,   maxInput: 1e6, efforts: LOW_TO_MAX, defaultEffort: 'high',   cache: CLAUDE_CACHE, reasoning: KD },
  'claude-sonnet-4-6': { provider: 'claude', name: 'Claude Sonnet 4.6', in: 3,    out: 15,  read: 0.1,   maxInput: 1e6, efforts: ['low', 'medium', 'high', 'max'], defaultEffort: 'high', cache: CLAUDE_CACHE, reasoning: KD },
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
}

export const PROVIDERS: Readonly<Record<Provider, { name: string; defaultModel: ModelId; sources: readonly (keyof typeof DOCS)[] }>> = {
  claude: { name: 'Claude', defaultModel: 'claude-opus-5-5', sources: ['claudePricing', 'claudeModels', 'claudeEffort', 'claudeThinking'] },
  openai: { name: 'OpenAI', defaultModel: 'gpt-5.6-sol', sources: ['openaiPricing', 'openaiCaching', 'openaiReasoning'] },
}

/** Models of one provider, in table order. */
export const modelsOf = (provider: Provider): [ModelId, ModelSpec][] =>
  Object.entries(MODELS).filter(([, m]) => m.provider === provider)

export const reasoningOptions = (m: ModelSpec): ReasoningMode[] =>
  m.reasoning.filter((r): r is ReasoningMode => r !== null)
export const reasoningDefault = (m: ModelSpec): ReasoningMode | null => m.reasoning[0] ?? null

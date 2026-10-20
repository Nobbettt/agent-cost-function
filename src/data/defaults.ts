import type { Setup, Shared } from '../model/types'

export const DEFAULT_SETUPS: Readonly<Record<'A' | 'B', Setup>> = {
  A: { provider: 'claude', model: 'claude-opus-5-5', cache: '5m', effort: 'high', reasoning: 'kept', interruptions: 3, pause: 20 },
  B: { provider: 'openai', model: 'gpt-5.6-sol', cache: '30m', effort: 'high', reasoning: 'kept', interruptions: 3, pause: 20 },
}

export const DEFAULT_SHARED: Shared = {
  session: 1000000, base: 20000, growth: 5000, visibleOut: 500,
  thinking: { none: 0, low: 300, medium: 1000, high: 2500, xhigh: 5000, max: 10000 },
}

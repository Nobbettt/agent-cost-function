import type { Setup, Shared } from '../model/types'

// The default comparison is the cache TTL trade-off: a 6 minute pause outlives the 5 minute cache but not the 1 hour one.
export const DEFAULT_SETUPS: Readonly<Record<'A' | 'B', Setup>> = {
  A: { provider: 'claude', model: 'claude-opus-5-5', cache: '5m', effort: 'high', reasoning: 'kept', interruptions: 7, pause: 6 },
  B: { provider: 'claude', model: 'claude-opus-5-5', cache: '1h', effort: 'high', reasoning: 'kept', interruptions: 7, pause: 6 },
}

export const DEFAULT_SHARED: Shared = {
  session: 1000000, base: 20000, growth: 5000, visibleOut: 500,
  thinking: { none: 0, low: 300, medium: 1000, high: 2500, xhigh: 5000, max: 10000 },
}

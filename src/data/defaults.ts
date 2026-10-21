import type { Setup, Shared } from '../model/types'

// The default comparison: the same session on a 5 minute and a 1 hour cache with 7 cache breaking interruptions each,
// and the 5 minute cache again with no interruptions at all (the best case, for reference).
export const DEFAULT_SETUPS: Readonly<Record<'A' | 'B' | 'C', Setup>> = {
  A: { id: 'A', provider: 'claude', model: 'claude-opus-5-5', cache: '5m', effort: 'high', reasoning: 'kept', interruptions: 7 },
  B: { id: 'B', provider: 'claude', model: 'claude-opus-5-5', cache: '1h', effort: 'high', reasoning: 'kept', interruptions: 7 },
  C: { id: 'C', provider: 'claude', model: 'claude-opus-5-5', cache: '5m', effort: 'high', reasoning: 'kept', interruptions: 0 },
}

/** The setups the page starts with, in order. */
export const DEFAULT_SETUP_LIST: readonly Setup[] = [DEFAULT_SETUPS.A, DEFAULT_SETUPS.B, DEFAULT_SETUPS.C]

export const DEFAULT_SHARED: Shared = {
  session: 1000000, base: 20000, growth: 5000, visibleOut: 500,
  thinking: { none: 0, low: 300, medium: 1000, high: 2500, xhigh: 5000, max: 10000 },
}

import type { Setup } from './types'

/**
 * The prototype's original default setups. Parity tests are pinned to these (not to the app's
 * current DEFAULT_SETUPS) so they keep proving the port reproduces the prototype to the cent.
 */
export const PROTOTYPE_SETUPS: Readonly<Record<'A' | 'B', Setup>> = {
  A: { id: 'A', provider: 'claude', model: 'claude-opus-5-5', cache: '5m', effort: 'high', reasoning: 'kept', interruptions: 3, pause: 20 },
  B: { id: 'B', provider: 'openai', model: 'gpt-5.6-sol', cache: '30m', effort: 'high', reasoning: 'kept', interruptions: 3, pause: 20 },
}

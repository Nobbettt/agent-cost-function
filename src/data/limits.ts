/**
 * Input ranges, shared by the number fields and by the share-link parser so both clamp the same way.
 * `clickStep` is what the field's "-" and "+" buttons move by (in the stored unit, snapped to its grid); `step` is the typing granularity.
 */
export const INTERRUPTION_LIMITS = { min: 0, max: 50, clickStep: 1 } as const

export const SHARED_LIMITS = {
  session: { min: 10000, max: 1000000, step: 10000, clickStep: 50000 },
  base: { min: 0, max: 200000, step: 1000, clickStep: 5000 },
  growth: { min: 500, max: 200000, step: 500, clickStep: 1000 },
  visibleOut: { min: 0, max: 64000, step: 100, clickStep: 100 },
  thinking: { min: 0, max: 128000, step: 100, clickStep: 500 },
} as const

/** Cache break-even page: how many interruptions its chart covers. */
export const SHOWN_LIMITS = { min: 4, max: 40, step: 1, clickStep: 1 } as const
export const DEFAULT_SHOWN = 12

/** Token inputs are shown and typed in thousands (K); everything stored and calculated stays in tokens. */
export const TOKENS_PER_K = 1000

/** Gemini explicit cache: how many hours the cache is kept (and its storage billed). */
export const EXPLICIT_HOURS_LIMITS = { min: 0.25, max: 168, step: 0.25, clickStep: 0.5 } as const
export const DEFAULT_EXPLICIT_HOURS = 2

/** Cache break-even page: how many pauses of each kind (5 to 60 min, and longer than an hour) the scenario has. */
export const PAUSE_LIMITS = { min: 0, max: 40, step: 1, clickStep: 1 } as const
export const DEFAULT_SHORT_PAUSES = 2
export const DEFAULT_LONG_PAUSES = 0

/** Cache keep-alive page: the cached context slider (tokens; its max is the model's max input), the ping's own tokens, and the chance (%) you come back (a slider in 5% steps). The ping interval's range depends on the cache. */
export const KEEP_ALIVE_LIMITS = {
  context: { min: 10000, step: 10000 },
  pingIn: { min: 0, max: 10000, step: 1, clickStep: 10 },
  pingOut: { min: 0, max: 64000, step: 1, clickStep: 10 },
  returnChance: { min: 0, max: 100, step: 5 },
} as const
// Ping tokens: the plugin's one-line question (~11 tokens) plus framing, and "OK" plus a little thinking (the fork inherits the session's effort).
export const KEEP_ALIVE_DEFAULTS = { context: 200000, pingIn: 20, pingOut: 10, returnChance: 100 } as const

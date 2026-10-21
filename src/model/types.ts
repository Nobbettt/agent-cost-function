export type Provider = 'claude' | 'openai' | 'xai'
export type ModelId = string
export type Effort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type ReasoningMode = 'kept' | 'dropped'
export type CacheId = '5m' | '1h' | '30m' | '24h' | 'in_memory' | 'auto'

export interface CacheOption {
  id: CacheId
  label: string
  /** Cache lifetime in minutes. */
  minutes: number
  /** Multiplier on input price for writing to the cache. */
  write: number
}

export interface LongPrompt {
  /** The prompt size where the higher rate starts: above it, or from it on when `inclusive`. */
  above: number
  /** True when a prompt that reaches `above` is already long (xAI: 200K); otherwise it must exceed it (OpenAI, Haiku). */
  inclusive?: boolean
  inMult: number
  outMult: number
}

/** Prices in USD per million tokens; `read` is the cache-read multiplier on input. */
export interface ModelSpec {
  provider: Provider
  name: string
  in: number
  out: number
  read: number
  maxInput: number
  efforts: readonly Effort[]
  defaultEffort: Effort | null
  cache: readonly CacheOption[]
  /** [default, ...other allowed]; a null default means the docs state none. */
  reasoning: readonly (ReasoningMode | null)[]
  longPrompt?: LongPrompt
}

/** Stable setup identity: its letter, and with it its colour and dash, never depends on position. */
export type SetupId = 'A' | 'B' | 'C' | 'D'

export interface Setup {
  id: SetupId
  provider: Provider
  model: ModelId
  cache: CacheId
  effort: Effort
  reasoning: ReasoningMode
  interruptions: number
  /** Custom display name; absent means "Setup X". Always set through cleanName. */
  name?: string
}

export interface Shared {
  session: number
  base: number
  growth: number
  visibleOut: number
  thinking: Record<Effort, number>
}

export interface Point {
  x: number
  cum: number
  req: number
  miss: boolean
}

export interface Totals {
  requests: number
  read: number
  write: number
  rewrite: number
  output: number
  total: number
}

export interface Run {
  points: Point[]
  totals: Totals
  end: number
}

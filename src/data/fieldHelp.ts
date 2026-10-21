import type { Effort } from '../model/types'

/** Short explanations shown by the "?" tips next to each field label. */
export const FIELD_HELP = {
  provider: "Which API's models and prices this setup uses.",
  model: 'The model the session runs on. It sets the input, output and cache prices and the maximum input size.',
  cache: 'How long the provider keeps the cached context, and what writing to the cache costs compared with normal input. A pause longer than this means the whole context is written again.',
  effort: 'How hard the model thinks on each request. Higher effort means more reasoning tokens, billed as output. The token amount per level is set in Shared assumptions.',
  reasoning: 'Kept: reasoning from earlier requests stays in the context and is read back as input on later requests. Dropped: only the visible conversation carries forward.',
  interruptions: 'How many times the session pauses. The pauses are spread evenly over the session.',
  pause: 'How long each pause lasts. If it outlives the cache, the next request pays to write the whole context to the cache again.',
  session: 'How large the context grows before the session ends. This is the x axis of the charts.',
  base: 'Tokens sent at the start of every request: system prompt, tool definitions and project instructions.',
  growth: 'Tokens added to the context by each request: tool results, user messages and the previous reply. Reasoning is not included.',
  visibleOut: 'Normal output per request (text and tool calls), billed as output tokens.',
  currency: 'Display currency. Costs are calculated in USD and converted at the daily ECB reference rate.',
} as const

export const thinkingHelp = (level: Effort): string =>
  `Assumed reasoning tokens per request at ${level} effort, billed as output. Providers don't publish these numbers, so this is a guess you can tune.`

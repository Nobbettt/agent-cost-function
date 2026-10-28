import type { Effort } from '../model/types'

/** Short explanations shown by the "?" tips next to each field label. */
export const FIELD_HELP = {
  provider: "Which API's models and prices this setup uses.",
  model: 'The model the session runs on. It sets the input, output and cache prices and the maximum input size.',
  cache: 'What the provider keeps cached between requests, and what that costs. Details depend on the provider; see the note below the field.',
  effort: 'How hard the model thinks on each request. Higher effort means more reasoning tokens, billed as output. The token amount per level is set in Advanced settings.',
  reasoning: 'Kept: reasoning from earlier requests stays in the context and is read back as input on later requests. Dropped: only the visible conversation carries forward.',
  interruptions: 'How many times the session pauses for longer than the cache lifetime. The pauses are spread evenly over the session, and each one makes the next request write the whole context to the cache again.',
  session: 'How large the context grows before the session ends. This is the x axis of the charts. Entered in thousands of tokens.',
  base: 'Tokens sent at the start of every request: system prompt, tool definitions and project instructions. Entered in thousands of tokens.',
  growth: 'Tokens added to the context by each request: tool results, user messages and the previous reply. Reasoning is not included. Entered in thousands of tokens.',
  visibleOut: 'Normal output per request (text and tool calls), billed as output tokens. Entered in thousands of tokens.',
  explicitHours: 'How long the session lasts in real time. The explicit cache is kept for this long, and storage is billed per hour.',
  pausesShort: 'Pauses longer than 5 minutes but no longer than an hour. Each one makes the 5-minute cache write the whole context again; the 1-hour cache survives it.',
  pausesLong: 'Pauses longer than an hour. Both caches expire, so both write the whole context again; the 1-hour cache pays 2× input for it.',
  interruptionsShown: 'How many pauses of 5–60 min the chart covers. It is extended to fit your pauses if they are more.',
  keepAliveProvider: 'Only providers whose cache has a known lifetime that every read restarts. xAI and Google cache best-effort, so a timed ping cannot keep them warm.',
  context: 'How large the conversation is when you step away: everything a ping reads from the cache, and everything a cold message writes again. Goes up to the model\'s maximum input.',
  pingInterval: 'Minutes between keep-alive pings. Each ping restarts the cache lifetime, so it has to come before the cache expires. The cache-saver-handoff plugin pings a minute before expiry.',
  pingIn: 'New input tokens each ping sends: its short question and any wrapper the client adds. A fork never caches its own tail, so they cost the normal input price.',
  pingOut: 'Output tokens each ping is billed for: the one-word reply plus any thinking the model does.',
  returnChance: 'How likely you are to come back to this session at all. The pings are paid either way; the re-write is saved only if you come back.',
  currency: 'Display currency. Costs are calculated in USD and converted at the daily ECB reference rate.',
} as const

export const thinkingHelp = (level: Effort): string =>
  `Assumed reasoning tokens per request at ${level} effort, billed as output. Providers don't publish these numbers, so this is a guess you can tune. Entered in thousands of tokens.`

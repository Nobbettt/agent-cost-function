import { MODELS, priceOn } from '../data/pricing'
import { rates } from './simulate'
import type { CacheId, CacheOption, ModelId } from './types'

/** Caches with a stated lifetime that every hit restarts: the only ones a ping in time is sure to keep warm. */
const KNOWN_TTL: readonly CacheId[] = ['5m', '1h', '30m']

export const hasKnownTtl = (cache: CacheOption): boolean => KNOWN_TTL.includes(cache.id)

/** A minute before the cache would expire (the handoff plugin's lead); 30 s before on a cache shorter than 10 min. */
export const defaultInterval = (cache: CacheOption): number => cache.minutes - (cache.minutes < 10 ? 0.5 : 1)

export interface KeepAliveInput {
  model: ModelId
  cache: CacheId
  /** Tokens in the cached conversation when you step away. */
  context: number
  /** Minutes between pings; clamped to 1..the cache lifetime. */
  interval: number
  /** New input tokens each ping sends (its one-word question). A fork's own tail is never cached, so they cost the normal input price. */
  pingIn: number
  /** Output tokens each ping is billed for: the reply and any thinking. */
  pingOut: number
  /** 0..1: the chance you come back to this session at all. */
  returnChance: number
}

export interface KeepAlive {
  /** Cache lifetime in minutes. */
  lifetime: number
  interval: number
  /** USD per ping: the whole context read from the cache, plus the ping's own input and output. */
  ping: number
  /** USD the next message costs more on a cold cache: the context written again instead of read. */
  rewrite: number
  /** `rewrite` times the chance you come back. */
  expected: number
  /** Pings that cost as much as the expected re-write. */
  breakEven: number
  /** Whole pings that still pay. */
  pings: number
  /** Minutes after your last message that those pings keep the cache warm. */
  covers: number
}

/**
 * Ping to keep the cache warm, or let it die and pay the re-write on return: what each costs, at the prices in force on `date`.
 * Throws for a cache with no known lifetime: pings can't be timed against it.
 */
export function keepAlive(input: KeepAliveInput, date?: string): KeepAlive {
  const base = MODELS[input.model]
  if (!base) throw new Error(`Unknown model: ${input.model}`)
  const model = priceOn(base, date)
  const cache = model.cache.find((c) => c.id === input.cache) ?? model.cache[0]
  if (!hasKnownTtl(cache)) throw new Error(`${model.name}'s ${cache.id} cache has no known lifetime`)
  const lifetime = cache.minutes
  const interval = Math.min(Math.max(input.interval, 1), lifetime)
  const context = Math.min(input.context, model.maxInput)
  const r = rates(model, context + input.pingIn)
  const ping = context * r.in * model.read + input.pingIn * r.in + input.pingOut * r.out
  const rewrite = context * r.in * (cache.write - model.read)
  const expected = rewrite * input.returnChance
  const breakEven = ping > 0 ? expected / ping : 0
  const pings = Math.floor(breakEven + 1e-9)
  return { lifetime, interval, ping, rewrite, expected, breakEven, pings, covers: pings * interval + lifetime }
}

/** Cost by minutes away: `keep` is the ping spend so far (a step at each ping), `die` the expected re-write once the cache has gone. */
export interface KeepAlivePoint { minutes: number; keep: number; die: number }

/** Points where either line steps, from 0 to `until` minutes; meant for a chart that holds each value until the next point. */
export function keepAliveCurve(r: KeepAlive, until: number): KeepAlivePoint[] {
  const pingTimes = Array.from({ length: Math.floor(until / r.interval) }, (_, k) => (k + 1) * r.interval)
  const xs = [...new Set([0, r.lifetime, ...pingTimes, until])].filter((x) => x <= until).sort((a, b) => a - b)
  return xs.map((minutes) => ({ minutes, keep: Math.floor(minutes / r.interval) * r.ping, die: minutes >= r.lifetime ? r.expected : 0 }))
}

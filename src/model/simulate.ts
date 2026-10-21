import { MODELS, priceOn } from '../data/pricing'
import type { ModelSpec, Point, Run, Setup, Shared, Totals } from './types'

/** Per-token input and output USD rates for a request whose prompt is `promptTokens` long. */
export function rates(model: ModelSpec, promptTokens: number) {
  const long = model.longPrompt && (model.longPrompt.inclusive ? promptTokens >= model.longPrompt.above : promptTokens > model.longPrompt.above)
  const lp = long ? model.longPrompt! : null
  return { in: (model.in / 1e6) * (lp ? lp.inMult : 1), out: (model.out / 1e6) * (lp ? lp.outMult : 1) }
}

/** Runs one agent session request by request, at the prices in force on `date`, until the context reaches the session length or the model's max input. */
export function simulate(setup: Setup, shared: Shared, date?: string): Run {
  const base = MODELS[setup.model]
  if (!base) throw new Error(`Unknown model: ${setup.model}`)
  // The caller says which day's prices apply (YYYY-MM-DD); without one the base prices are used. Never reads the clock.
  const model = priceOn(base, date)
  const cache = model.cache.find((c) => c.id === setup.cache) ?? model.cache[0]
  const end = Math.min(shared.session, model.maxInput)
  // Every interruption outlasts the cache lifetime: the request after it re-writes the whole context.
  const breaks = Array.from({ length: setup.interruptions }, (_, k) => (end * (k + 1)) / (setup.interruptions + 1))
  const reasoningTokens = shared.thinking[setup.effort]
  const outTokens = shared.visibleOut + reasoningTokens
  const step = shared.growth + (setup.reasoning === 'kept' ? reasoningTokens : 0)
  const points: Point[] = []
  // An explicit cache (Gemini 3.x only) keeps the fixed prompt (the base tokens) cached for `explicitHours`, for an hourly storage fee.
  const explicit = model.explicitStorage !== undefined && setup.explicitHours !== undefined
  let totals: Totals = { requests: 0, read: 0, write: 0, rewrite: 0, storage: 0, output: 0, total: 0 }
  let prev = 0
  let nextBreak = 0

  for (let ctx = shared.base; ctx <= end; ctx += step) {
    let miss = false
    while (nextBreak < breaks.length && ctx >= breaks[nextBreak]) {
      miss = true
      nextBreak++
    }
    const r = rates(model, ctx)
    // After a break the base tokens are still in the explicit cache: read at the cached rate, and only the rest is written again.
    const kept = explicit && miss ? Math.min(shared.base, prev) : 0
    const read = (prev && !miss ? prev : kept) * r.in * model.read
    const write = (ctx - prev) * r.in * cache.write
    const rewrite = miss ? (prev - kept) * r.in * cache.write : 0
    const output = outTokens * r.out
    const cost = read + write + rewrite + output
    // Storage is committed when the cache is created with the first request, so it sits in the first point's running total
    // (not in the per-request cost): billed for the whole `explicitHours` on the base tokens.
    const storage = explicit && prev === 0 ? (shared.base * setup.explicitHours! * model.explicitStorage!) / 1e6 : 0
    totals = {
      requests: totals.requests + 1,
      read: totals.read + read,
      write: totals.write + write,
      rewrite: totals.rewrite + rewrite,
      storage: totals.storage + storage,
      output: totals.output + output,
      total: totals.total + storage + cost,
    }
    points.push({ x: ctx, cum: totals.total, req: cost, miss })
    prev = ctx
  }
  return { points, totals, end }
}

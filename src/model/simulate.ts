import { MODELS } from '../data/pricing'
import type { ModelSpec, Point, Run, Setup, Shared, Totals } from './types'

/** Per-token input and output USD rates for a request whose prompt is `promptTokens` long. */
export function rates(model: ModelSpec, promptTokens: number) {
  const lp = model.longPrompt && promptTokens > model.longPrompt.above ? model.longPrompt : null
  return { in: (model.in / 1e6) * (lp ? lp.inMult : 1), out: (model.out / 1e6) * (lp ? lp.outMult : 1) }
}

/** Runs one agent session request by request until the context reaches the session length or the model's max input. */
export function simulate(setup: Setup, shared: Shared): Run {
  const model = MODELS[setup.model]
  if (!model) throw new Error(`Unknown model: ${setup.model}`)
  const cache = model.cache.find((c) => c.id === setup.cache) ?? model.cache[0]
  const end = Math.min(shared.session, model.maxInput)
  // Every interruption outlasts the cache lifetime: the request after it re-writes the whole context.
  const breaks = Array.from({ length: setup.interruptions }, (_, k) => (end * (k + 1)) / (setup.interruptions + 1))
  const reasoningTokens = shared.thinking[setup.effort]
  const outTokens = shared.visibleOut + reasoningTokens
  const step = shared.growth + (setup.reasoning === 'kept' ? reasoningTokens : 0)
  const points: Point[] = []
  let totals: Totals = { requests: 0, read: 0, write: 0, rewrite: 0, output: 0, total: 0 }
  let prev = 0
  let nextBreak = 0

  for (let ctx = shared.base; ctx <= end; ctx += step) {
    let miss = false
    while (nextBreak < breaks.length && ctx >= breaks[nextBreak]) {
      miss = true
      nextBreak++
    }
    const r = rates(model, ctx)
    const read = prev && !miss ? prev * r.in * model.read : 0
    const write = (ctx - prev) * r.in * cache.write
    const rewrite = miss ? prev * r.in * cache.write : 0
    const output = outTokens * r.out
    const cost = read + write + rewrite + output
    totals = {
      requests: totals.requests + 1,
      read: totals.read + read,
      write: totals.write + write,
      rewrite: totals.rewrite + rewrite,
      output: totals.output + output,
      total: totals.total + cost,
    }
    points.push({ x: ctx, cum: totals.total, req: cost, miss })
    prev = ctx
  }
  return { points, totals, end }
}

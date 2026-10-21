import { simulate } from './simulate'
import type { Setup, Shared } from './types'

/** Session cost at `k` interruptions, for each of the two Claude caches. */
export interface CurvePoint {
  k: number
  /** 5 minute cache: each of the k interruptions (a pause of 5 to 60 minutes) breaks it. */
  cost5: number
  /** 1 hour cache: none of those pauses breaks it, so this is the same for every k. */
  cost1h: number
}

/**
 * Cost of the same session on the 5 minute and on the 1 hour cache for 0..maxK interruptions. The pauses are longer
 * than 5 minutes but shorter than an hour: they break the 5 minute cache (the next request re-writes the whole
 * context) and never the 1 hour cache. `base`'s cache and interruptions are ignored. Pricing lives in `simulate`.
 */
export function costCurve(base: Setup, shared: Shared, maxK: number): CurvePoint[] {
  const cost1h = simulate({ ...base, cache: '1h', interruptions: 0 }, shared).totals.total
  return Array.from({ length: maxK + 1 }, (_, k) => ({
    k,
    cost5: simulate({ ...base, cache: '5m', interruptions: k }, shared).totals.total,
    cost1h,
  }))
}

export interface BreakEven {
  /** The interruption count where the two costs meet (linear between the two integer counts), or null. */
  exact: number | null
  /** The smallest whole number of interruptions from which the 1 hour cache is cheaper, or null. */
  firstK: number | null
}

/** Where the 1 hour cache starts to be cheaper; both null when it never is within the curve. */
export function breakEven(curve: readonly CurvePoint[]): BreakEven {
  const first = curve.findIndex((p) => p.cost5 > p.cost1h)
  if (first < 0) return { exact: null, firstK: null }
  if (first === 0) return { exact: 0, firstK: 0 }
  const a = curve[first - 1]
  const b = curve[first]
  const before = a.cost1h - a.cost5 // >= 0
  const after = b.cost5 - b.cost1h // > 0
  return { exact: a.k + before / (before + after), firstK: b.k }
}

/** What one interruption adds on the 5 minute cache, on average over the curve. */
export function avgBreakCost(curve: readonly CurvePoint[]): number {
  const last = curve.at(-1)
  return last && last.k > 0 ? (last.cost5 - curve[0].cost5) / last.k : 0
}

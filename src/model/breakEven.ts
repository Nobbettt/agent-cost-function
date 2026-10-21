import { simulate } from './simulate'
import type { Setup, Shared } from './types'

/** Session cost on each of the two Claude caches, for `k` pauses of 5 to 60 minutes (and a fixed number of longer ones). */
export interface CurvePoint {
  k: number
  /** 5 minute cache: every pause breaks it, the k short ones and the longer ones alike. */
  cost5: number
  /** 1 hour cache: only the longer pauses break it, so this is the same for every k. */
  cost1h: number
}

/**
 * Cost of the same session on the 5 minute and on the 1 hour cache for k = 0..maxK pauses of 5 to 60 minutes, with
 * `long` pauses over an hour on top. A short pause (longer than 5 minutes, up to an hour) breaks only the 5 minute cache
 * (the next request re-writes the whole context); a long one breaks both, and the 1 hour cache pays 2x input for that
 * re-write. Each kind is spread evenly over the session, as in the calculator. `base`'s cache and interruptions are
 * ignored; pricing lives in `simulate`, at the prices in force on `date`.
 */
export function costCurve(base: Setup, shared: Shared, maxK: number, long = 0, date?: string): CurvePoint[] {
  const cost1h = simulate({ ...base, cache: '1h', interruptions: long }, shared, date).totals.total
  return Array.from({ length: maxK + 1 }, (_, k) => ({
    k,
    cost5: simulate({ ...base, cache: '5m', interruptions: k + long }, shared, date).totals.total,
    cost1h,
  }))
}

/** The curve's point for `k` short pauses, or its last point when `k` is beyond the curve. */
export const costsAt = (curve: readonly CurvePoint[], k: number): CurvePoint => curve[Math.min(Math.max(k, 0), curve.length - 1)]

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

/** How many pauses of 5 to 60 minutes the chart covers: the chosen range, extended to `short + 2` (at most `max`) when `short` is beyond it. */
export const chartRange = (range: number, short: number, max: number): number => (short > range ? Math.min(short + 2, max) : range)

/** Who is cheaper at a point, and by how much: `percent` is the saving as a share of the dearer cache, rounded. */
export function cheaperAt(point: Pick<CurvePoint, 'cost5' | 'cost1h'>): { cheaper: '5m' | '1h' | null; saving: number; percent: number } {
  const diff = point.cost5 - point.cost1h
  if (Math.abs(diff) < 1e-9) return { cheaper: null, saving: 0, percent: 0 }
  const dearer = Math.max(point.cost5, point.cost1h)
  return { cheaper: diff > 0 ? '1h' : '5m', saving: Math.abs(diff), percent: Math.round((Math.abs(diff) / dearer) * 100) }
}

/** One cell of the short x long map: the session cost on each cache, and what the 1 hour cache saves (negative: it costs more). */
export interface GridCell {
  /** Pauses of 5 to 60 minutes. */
  short: number
  /** Pauses over an hour. */
  long: number
  cost5: number
  cost1h: number
  saving: number
}

/**
 * Both kinds of pause at once: for short = 0..maxShort and long = 0..maxLong, long-major. The rules are those of `costCurve`:
 * the 5 minute cache breaks on every pause (short + long), the 1 hour cache only on the long ones, so its cost is worked
 * out once per `long` and is the same along a row.
 */
export function breakEvenGrid(base: Setup, shared: Shared, maxShort: number, maxLong: number, date?: string): GridCell[] {
  const cells: GridCell[] = []
  for (let long = 0; long <= maxLong; long++) {
    const cost1h = simulate({ ...base, cache: '1h', interruptions: long }, shared, date).totals.total
    for (let short = 0; short <= maxShort; short++) {
      const cost5 = simulate({ ...base, cache: '5m', interruptions: short + long }, shared, date).totals.total
      cells.push({ short, long, cost5, cost1h, saving: cost5 - cost1h })
    }
  }
  return cells
}

/** Rows of a grid as break-even curves, by `long`. */
export function gridRows(grid: readonly GridCell[]): { long: number; cells: GridCell[] }[] {
  const rows = new Map<number, GridCell[]>()
  for (const c of grid) rows.set(c.long, [...(rows.get(c.long) ?? []), c])
  return [...rows].map(([long, cells]) => ({ long, cells }))
}

/** For each `long`, the exact short count where the two caches cost the same (as `breakEven` finds it), or null within range. */
export function boundary(grid: readonly GridCell[]): { long: number; exact: number | null }[] {
  return gridRows(grid).map(({ long, cells }) => ({
    long,
    exact: breakEven(cells.map((c) => ({ k: c.short, cost5: c.cost5, cost1h: c.cost1h }))).exact,
  }))
}

/** How many rows (pauses over an hour) the map shows: at least 6, and always your own count plus 2, at most `max`. */
export const longRange = (long: number, max: number): number => Math.min(max, Math.max(6, long + 2))

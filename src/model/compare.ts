import type { Run } from './types'

export interface Comparison {
  /** Largest context both setups reach. */
  common: number
  a: number
  b: number
  /** The cheaper setup, or null when equal. */
  cheaper: 'A' | 'B' | null
  /** Rounded percentage the cheaper setup saves at `common`. */
  percent: number
  /** True when one model stops earlier than the other at its max input. */
  capped: boolean
}

/** Compares two runs at the largest context both reach; a model's max input can end one run early. */
export function compare(runA: Run, runB: Run): Comparison {
  const common = Math.min(runA.points.at(-1)?.x ?? 0, runB.points.at(-1)?.x ?? 0)
  const cumAt = (run: Run) => run.points.filter((p) => p.x <= common).at(-1)?.cum ?? 0
  const a = cumAt(runA)
  const b = cumAt(runB)
  return {
    common,
    a,
    b,
    cheaper: a === b ? null : a < b ? 'A' : 'B',
    percent: Math.round((Math.abs(a - b) / Math.max(a, b)) * 100),
    capped: runA.end !== runB.end,
  }
}

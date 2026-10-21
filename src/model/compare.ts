import type { Run, SetupId } from './types'

export interface RunEntry {
  id: SetupId
  run: Run
}

export interface Comparison {
  /** Largest context every run reaches. */
  common: number
  /** Cumulative cost of each run at `common`, in the order given. */
  values: { id: SetupId; value: number }[]
  /** The cheapest setup (the first, on a tie for lowest), or null when all cost the same. */
  cheapest: SetupId | null
  /** The most expensive setup (the first, on a tie for highest), or null when all cost the same. */
  mostExpensive: SetupId | null
  /** Most expensive minus cheapest, at `common`. */
  saving: number
  /** `saving` as a rounded percentage of the most expensive. */
  percent: number
  /** True when the runs do not all end at the same size, i.e. a model stops early at its max input. */
  capped: boolean
}

/** Compares runs at the largest context all of them reach; a model's max input can end a run early. */
export function compare(entries: readonly RunEntry[]): Comparison {
  const common = entries.length ? Math.min(...entries.map((e) => e.run.points.at(-1)?.x ?? 0)) : 0
  const values = entries.map((e) => ({ id: e.id, value: e.run.points.filter((p) => p.x <= common).at(-1)?.cum ?? 0 }))
  const nums = values.map((v) => v.value)
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const tied = values.length === 0 || min === max
  const ends = entries.map((e) => e.run.end)
  return {
    common,
    values,
    cheapest: tied ? null : values.find((v) => v.value === min)!.id,
    mostExpensive: tied ? null : values.find((v) => v.value === max)!.id,
    saving: tied ? 0 : max - min,
    percent: tied ? 0 : Math.round(((max - min) / max) * 100),
    capped: new Set(ends).size > 1,
  }
}

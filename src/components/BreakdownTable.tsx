import { MODELS } from '../data/pricing'
import { signedMoney } from '../format'
import { displayName, usesExplicitCache } from '../model/setups'
import type { Run, Setup } from '../model/types'

const COLS = ['Setup', 'Requests', 'Cache reads', 'Cache writes', 'Re-writes after cache breaks', 'Output + reasoning', 'Explicit cache storage', 'Total', 'vs cheapest']

const setupName = (s: Setup) => `${displayName(s)}: ${MODELS[s.model].name}, ${s.cache}, ${s.effort}, reasoning ${s.reasoning}`

interface Props {
  runs: readonly Run[]
  setups: readonly Setup[]
  format: (usd: number) => string
}

/** One row per setup, with how much more than the cheapest each costs over the whole session. */
export function BreakdownTable({ runs, setups, format: f }: Props) {
  const cheapest = Math.min(...runs.map((r) => r.totals.total))
  // The storage column only exists while some setup keeps an explicit cache.
  const withStorage = setups.some(usesExplicitCache)
  const rows = setups.map((s, i) => {
    const t = runs[i].totals
    const extra = t.total - cheapest
    return [
      setupName(s), String(t.requests), f(t.read), f(t.write), f(t.rewrite), f(t.output),
      ...(withStorage ? [usesExplicitCache(s) ? f(t.storage) : '—'] : []),
      f(t.total), Math.abs(extra) < 1e-9 ? 'cheapest' : signedMoney(extra, f),
    ]
  })
  const cols = withStorage ? COLS : COLS.filter((c) => c !== 'Explicit cache storage')
  return (
    <table>
      <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => <tr key={setups[i].id}>{r.map((v, i) => <td key={i}>{v}</td>)}</tr>)}
      </tbody>
    </table>
  )
}

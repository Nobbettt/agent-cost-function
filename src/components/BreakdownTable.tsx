import { MODELS } from '../data/pricing'
import { fmtUsd } from '../format'
import type { Run, Setup, Totals } from '../model/types'

const COLS = ['Setup', 'Requests', 'Cache reads', 'Cache writes', 'Re-writes after pauses', 'Output + reasoning', 'Total']

const setupName = (s: Setup, id: string) => `${id}: ${MODELS[s.model].name}, ${s.cache}, ${s.effort}, reasoning ${s.reasoning}`
const line = (name: string, t: Totals) =>
  [name, String(t.requests), fmtUsd(t.read), fmtUsd(t.write), fmtUsd(t.rewrite), fmtUsd(t.output), fmtUsd(t.total)]
const signed = (v: number) => (Math.abs(v) < 1e-9 ? '$0' : `${v < 0 ? '−' : '+'}${fmtUsd(Math.abs(v))}`)

interface Props {
  runs: readonly [Run, Run]
  setups: readonly [Setup, Setup]
}

export function BreakdownTable({ runs, setups }: Props) {
  const [a, b] = [runs[0].totals, runs[1].totals]
  const rows = [
    line(setupName(setups[0], 'A'), a),
    line(setupName(setups[1], 'B'), b),
    ['B − A', String(b.requests - a.requests), signed(b.read - a.read), signed(b.write - a.write),
     signed(b.rewrite - a.rewrite), signed(b.output - a.output), signed(b.total - a.total)],
  ]
  return (
    <table>
      <thead><tr>{COLS.map((c) => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>
        {rows.map((r) => <tr key={r[0]}>{r.map((v, i) => <td key={i}>{v}</td>)}</tr>)}
      </tbody>
    </table>
  )
}

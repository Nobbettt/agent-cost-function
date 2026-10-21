import { MODELS } from '../data/pricing'
import type { Run, Setup, Totals } from '../model/types'

const COLS = ['Setup', 'Requests', 'Cache reads', 'Cache writes', 'Re-writes after pauses', 'Output + reasoning', 'Total']

const setupName = (s: Setup, id: string) => `${id}: ${MODELS[s.model].name}, ${s.cache}, ${s.effort}, reasoning ${s.reasoning}`
type Format = (usd: number) => string
const line = (name: string, t: Totals, f: Format) =>
  [name, String(t.requests), f(t.read), f(t.write), f(t.rewrite), f(t.output), f(t.total)]
const signed = (v: number, f: Format) => (Math.abs(v) < 1e-9 ? f(0) : `${v < 0 ? '−' : '+'}${f(Math.abs(v))}`)

interface Props {
  runs: readonly [Run, Run]
  setups: readonly [Setup, Setup]
  format: Format
}

export function BreakdownTable({ runs, setups, format: f }: Props) {
  const [a, b] = [runs[0].totals, runs[1].totals]
  const rows = [
    line(setupName(setups[0], 'A'), a, f),
    line(setupName(setups[1], 'B'), b, f),
    ['B − A', String(b.requests - a.requests), signed(b.read - a.read, f), signed(b.write - a.write, f),
     signed(b.rewrite - a.rewrite, f), signed(b.output - a.output, f), signed(b.total - a.total, f)],
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

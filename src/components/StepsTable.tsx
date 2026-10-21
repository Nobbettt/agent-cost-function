import { fmtTokens } from '../format'
import { displayName } from '../model/setups'
import type { Point, Run, Setup } from '../model/types'

const at = (points: readonly Point[], x: number) => points.filter((p) => p.x <= x).at(-1)

interface Props {
  runs: readonly Run[]
  setups: readonly Setup[]
  session: number
  format: (usd: number) => string
}

/** Cumulative cost at ten even steps up to the session length, one column per setup. */
export function StepsTable({ runs, setups, session, format }: Props) {
  const steps = Array.from({ length: 10 }, (_, k) => (session * (k + 1)) / 10)
  return (
    <table>
      <thead><tr><th>Context</th>{setups.map((s) => <th key={s.id}>{displayName(s)}</th>)}</tr></thead>
      <tbody>
        {steps.map((x) => (
          <tr key={x}>
            <td>{fmtTokens(x)}</td>
            {runs.map((r, i) => <td key={setups[i].id}>{x > r.end ? '—' : format(at(r.points, x)?.cum ?? 0)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

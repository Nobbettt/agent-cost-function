import { fmtTokens } from '../format'
import type { Point, Run, SetupId } from '../model/types'

const at = (points: readonly Point[], x: number) => points.filter((p) => p.x <= x).at(-1)

interface Props {
  runs: readonly Run[]
  ids: readonly SetupId[]
  session: number
  format: (usd: number) => string
}

/** Cumulative cost at ten even steps up to the session length, one column per setup. */
export function StepsTable({ runs, ids, session, format }: Props) {
  const steps = Array.from({ length: 10 }, (_, k) => (session * (k + 1)) / 10)
  return (
    <table>
      <thead><tr><th>Context</th>{ids.map((id) => <th key={id}>Setup {id}</th>)}</tr></thead>
      <tbody>
        {steps.map((x) => (
          <tr key={x}>
            <td>{fmtTokens(x)}</td>
            {runs.map((r, i) => <td key={ids[i]}>{x > r.end ? '—' : format(at(r.points, x)?.cum ?? 0)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

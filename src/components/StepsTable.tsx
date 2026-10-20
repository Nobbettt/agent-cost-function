import { fmtTokens, fmtUsd } from '../format'
import type { Point, Run } from '../model/types'

const at = (points: readonly Point[], x: number) => points.filter((p) => p.x <= x).at(-1)

export function StepsTable({ runs, session }: { runs: readonly [Run, Run]; session: number }) {
  const steps = Array.from({ length: 10 }, (_, k) => (session * (k + 1)) / 10)
  return (
    <table>
      <thead><tr><th>Context</th><th>Setup A</th><th>Setup B</th></tr></thead>
      <tbody>
        {steps.map((x) => (
          <tr key={x}>
            <td>{fmtTokens(x)}</td>
            {runs.map((r, i) => <td key={i}>{x > r.end ? '—' : fmtUsd(at(r.points, x)?.cum ?? 0)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

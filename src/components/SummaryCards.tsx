import { fmtTokens } from '../format'
import type { Comparison } from '../model/compare'
import { modelAndCache } from '../model/setups'
import type { Setup, SetupId } from '../model/types'
import { SeriesKey } from './SeriesKey'

interface StatProps {
  label: string
  value: string
  sub: string
  /** Draws the series key (colour and dash) before the label, like the chart legend. */
  series?: SetupId
}

function Stat({ label, value, sub, series }: StatProps) {
  return (
    <div className="stat">
      <dt>
        {series && <SeriesKey id={series} />}
        {label}
      </dt>
      <dd>
        <span className="stat-value">{value}</span>
        <span className="stat-sub">{sub}</span>
      </dd>
    </div>
  )
}

interface Props {
  comparison: Comparison
  setups: readonly Setup[]
  format: (usd: number) => string
}

/** The result at a glance: each setup's cost, the cheapest one, and the context size they are compared at. */
export function SummaryCards({ comparison: c, setups, format }: Props) {
  const valueOf = (id: SetupId) => c.values.find((v) => v.id === id)?.value ?? 0
  const cheapest =
    c.cheapest === null
      ? { value: 'Equal', sub: 'All cost the same' }
      : {
          value: `Setup ${c.cheapest}`,
          sub: `saves ${format(c.saving)} (${c.percent}%) vs Setup ${c.mostExpensive}`,
        }
  return (
    <section className="summary" aria-label="Summary" data-count={setups.length + 2}>
      <dl>
        {setups.map((s) => (
          <Stat key={s.id} label={`Setup ${s.id}`} series={s.id} value={format(valueOf(s.id))} sub={modelAndCache(s)} />
        ))}
        <Stat label="Cheapest" value={cheapest.value} sub={cheapest.sub} />
        <Stat
          label="Compared at" value={`${fmtTokens(c.common)} tokens`}
          sub={c.capped ? 'One model stops earlier at its max input' : 'context size'}
        />
      </dl>
    </section>
  )
}

import { MODELS } from '../data/pricing'
import { fmtTokens, signedMoney } from '../format'
import type { Comparison } from '../model/compare'
import type { CacheId, Setup } from '../model/types'

const CACHE_LABEL: Record<CacheId, string> = { '5m': '5 min', '1h': '1 hour', '30m': '30 min', '24h': '24h', in_memory: 'in_memory' }

const subtitle = (s: Setup) => `${MODELS[s.model].name} · ${CACHE_LABEL[s.cache]} cache`

interface StatProps {
  label: string
  value: string
  sub: string
  /** Draws the series colour key before the label, like the chart legend. */
  series?: 'A' | 'B'
}

function Stat({ label, value, sub, series }: StatProps) {
  return (
    <div className="stat" data-series={series}>
      <dt>
        {series && <span className="key" aria-hidden="true" />}
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
  setups: readonly [Setup, Setup]
  format: (usd: number) => string
}

/** The result at a glance: each setup's cost, the difference, and the context size they are compared at. */
export function SummaryCards({ comparison: c, setups, format }: Props) {
  const verdict = c.cheaper === null ? 'Both cost the same' : `${c.cheaper} is ${c.percent}% cheaper`
  return (
    <section className="summary" aria-label="Summary">
      <dl>
        <Stat label="Setup A" series="A" value={format(c.a)} sub={subtitle(setups[0])} />
        <Stat label="Setup B" series="B" value={format(c.b)} sub={subtitle(setups[1])} />
        <Stat label="Difference (B − A)" value={signedMoney(c.b - c.a, format)} sub={verdict} />
        <Stat
          label="Compared at" value={`${fmtTokens(c.common)} tokens`}
          sub={c.capped ? 'One model stops earlier at its max input' : 'context size'}
        />
      </dl>
    </section>
  )
}

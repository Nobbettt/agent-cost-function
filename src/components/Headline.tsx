import { fmtTokens, fmtUsd } from '../format'
import type { Comparison } from '../model/compare'

export function Headline({ comparison: c }: { comparison: Comparison }) {
  const cheaper = c.cheaper === null ? 'Both cost the same.' : `${c.cheaper} is ${c.percent}% cheaper.`
  const capped = c.capped ? ' One model stops earlier at its max input.' : ''
  return (
    <p className="headline" id="headline">
      {`At ${fmtTokens(c.common)} tokens of context: A ${fmtUsd(c.a)} · B ${fmtUsd(c.b)}. ${cheaper}${capped}`}
    </p>
  )
}

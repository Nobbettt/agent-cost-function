import { fmtTokens } from '../format'
import type { Comparison } from '../model/compare'

export function Headline({ comparison: c, format }: { comparison: Comparison; format: (usd: number) => string }) {
  const cheaper = c.cheaper === null ? 'Both cost the same.' : `${c.cheaper} is ${c.percent}% cheaper.`
  const capped = c.capped ? ' One model stops earlier at its max input.' : ''
  return (
    <p className="headline" id="headline">
      {`At ${fmtTokens(c.common)} tokens of context: A ${format(c.a)} · B ${format(c.b)}. ${cheaper}${capped}`}
    </p>
  )
}

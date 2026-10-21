import { SERIES } from '../data/series'
import type { SetupId } from '../model/types'

/** The 16×2px line key of a setup, in its series colour and dash, like the chart legend. */
export function SeriesKey({ id }: { id: SetupId }) {
  const { cssVar, dash } = SERIES[id]
  return (
    <svg className="key" width="16" height="2" viewBox="0 0 16 2" aria-hidden="true" focusable="false">
      <line x1="0" y1="1" x2="16" y2="1" stroke={`var(${cssVar})`} strokeWidth="2" strokeDasharray={dash.join(' ') || undefined} />
    </svg>
  )
}

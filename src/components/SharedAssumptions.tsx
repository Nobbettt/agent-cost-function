import { DEFAULT_SHARED } from '../data/defaults'
import { FIELD_HELP, thinkingHelp } from '../data/fieldHelp'
import { ALL_EFFORTS } from '../data/pricing'
import type { Effort, Shared } from '../model/types'
import { NumberField } from './NumberField'

interface Props {
  shared: Shared
  onChange: (next: Shared) => void
}

type ScalarKey = 'session' | 'base' | 'growth' | 'visibleOut'

const SCALARS: { key: ScalarKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'session', label: 'Session length (tokens)', min: 10000, max: 1000000, step: 10000 },
  { key: 'base', label: 'System prompt + tools (tokens)', min: 0, max: 200000, step: 1000 },
  { key: 'growth', label: 'New context per request, excl. reasoning (tokens)', min: 500, max: 200000, step: 500 },
  { key: 'visibleOut', label: 'Visible output per request (tokens)', min: 0, max: 64000, step: 100 },
]

const thinkingLabel = (e: Effort) => (e === 'none' ? 'Reasoning per request: none' : `Reasoning: ${e}`)

export function SharedAssumptions({ shared, onChange }: Props) {
  return (
    <details className="card" id="shared">
      <summary>Shared assumptions</summary>
      <div className="fields">
        {SCALARS.map(({ key, label, ...range }) => (
          <NumberField
            key={key} label={label} help={FIELD_HELP[key]} name={key} {...range}
            fallback={DEFAULT_SHARED[key]} value={shared[key]}
            onChange={(v) => onChange({ ...shared, [key]: v })}
          />
        ))}
        {ALL_EFFORTS.map((e) => (
          <NumberField
            key={e} label={thinkingLabel(e)} help={thinkingHelp(e)} name={`think-${e}`} min={0} max={128000} step={100}
            fallback={DEFAULT_SHARED.thinking[e]} value={shared.thinking[e]}
            onChange={(v) => onChange({ ...shared, thinking: { ...shared.thinking, [e]: v } })}
          />
        ))}
      </div>
    </details>
  )
}

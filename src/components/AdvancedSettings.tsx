import { DEFAULT_SHARED } from '../data/defaults'
import { FIELD_HELP, thinkingHelp } from '../data/fieldHelp'
import { SHARED_LIMITS } from '../data/limits'
import { ALL_EFFORTS } from '../data/pricing'
import type { Effort, Shared } from '../model/types'
import { Chevron } from './Chevron'
import { NumberField } from './NumberField'

interface Props {
  shared: Shared
  onChange: (next: Shared) => void
  expanded: boolean
  onToggle: () => void
  /** Fields shown elsewhere on the page, so they are not repeated here. */
  omit?: readonly ScalarKey[]
}

export type ScalarKey = 'session' | 'base' | 'growth' | 'visibleOut'

const SCALARS: { key: ScalarKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'session', label: 'Session length (tokens)', ...SHARED_LIMITS.session },
  { key: 'base', label: 'System prompt + tools (tokens)', ...SHARED_LIMITS.base },
  { key: 'growth', label: 'Added per request (tokens)', ...SHARED_LIMITS.growth },
  { key: 'visibleOut', label: 'Output per request (tokens)', ...SHARED_LIMITS.visibleOut },
]

const thinkingLabel = (e: Effort) => `Reasoning tokens: ${e}`

export function AdvancedSettings({ shared, onChange, expanded, onToggle, omit = [] }: Props) {
  return (
    <div className="setup advanced" id="advanced" role="group" aria-labelledby="advanced-title">
      <div className="setup-head">
        <button
          type="button" id="advanced-toggle" className="setup-toggle"
          aria-expanded={expanded} aria-controls="advanced-body" onClick={onToggle}
        >
          <Chevron />
          <span className="setup-title"><span id="advanced-title">Advanced settings</span></span>
        </button>
      </div>
      <div className="setup-body" id="advanced-body" hidden={!expanded}>
        <div className="fields">
          {SCALARS.filter(({ key }) => !omit.includes(key)).map(({ key, label, ...range }) => (
            <NumberField
              key={key} label={label} help={FIELD_HELP[key]} name={key} {...range}
              fallback={DEFAULT_SHARED[key]} value={shared[key]}
              onChange={(v) => onChange({ ...shared, [key]: v })}
            />
          ))}
          {ALL_EFFORTS.map((e) => (
            <NumberField
              key={e} label={thinkingLabel(e)} help={thinkingHelp(e)} name={`think-${e}`} {...SHARED_LIMITS.thinking}
              fallback={DEFAULT_SHARED.thinking[e]} value={shared.thinking[e]}
              onChange={(v) => onChange({ ...shared, thinking: { ...shared.thinking, [e]: v } })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

import { Fragment, useId } from 'react'
import { DEFAULT_SETUPS } from '../data/defaults'
import { FIELD_HELP } from '../data/fieldHelp'
import { MODELS, PROVIDERS, modelsOf, reasoningDefault, reasoningOptions } from '../data/pricing'
import { switchModel, switchProvider } from '../model/normalize'
import { summarizeSetup } from '../model/setups'
import type { CacheId, Effort, Provider, ReasoningMode, Setup } from '../model/types'
import { Chevron } from './Chevron'
import { Field } from './Field'
import { InfoTip } from './InfoTip'
import { NumberField } from './NumberField'
import { SeriesKey } from './SeriesKey'

interface Props {
  setup: Setup
  expanded: boolean
  onToggle: () => void
  onChange: (next: Setup) => void
  /** Present only while removing is allowed (more than two setups). */
  onRemove?: () => void
}

export function SetupPanel({ setup, expanded, onToggle, onChange, onRemove }: Props) {
  const { id } = setup
  const uid = useId()
  const model = MODELS[setup.model]
  const d = DEFAULT_SETUPS.A // fallback for the interruption fields; every default setup shares these
  const set = (patch: Partial<Setup>) => onChange({ ...setup, ...patch })

  return (
    <div className="setup" role="group" aria-labelledby={`setup-${id}-title`} data-id={id}>
      <div className="setup-head">
        <button
          type="button" id={`setup-${id}-toggle`} className="setup-toggle"
          aria-expanded={expanded} aria-controls={`setup-${id}-body`} onClick={onToggle}
        >
          <Chevron />
          <span className="setup-title">
            <SeriesKey id={id} />
            <span id={`setup-${id}-title`}>Setup {id}</span>
          </span>
          {!expanded && <span className="setup-summary">{summarizeSetup(setup)}</span>}
        </button>
        {onRemove && (
          <button type="button" className="setup-remove" aria-label={`Remove setup ${id}`} onClick={onRemove}>
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
            </svg>
          </button>
        )}
      </div>
      <div className="setup-body" id={`setup-${id}-body`} hidden={!expanded}>
        <div className="provider-field">
          <div className="field-head">
            <span className="field-label">Provider</span>
            <InfoTip label="Provider" text={FIELD_HELP.provider} />
          </div>
          <div className="toggle" role="radiogroup" aria-label={`Provider for setup ${id}`}>
            {(Object.entries(PROVIDERS) as [Provider, (typeof PROVIDERS)[Provider]][]).map(([k, p]) => (
              <Fragment key={k}>
                <input
                  type="radio"
                  name={`provider-${id}`}
                  id={`provider-${id}-${k}`}
                  value={k}
                  checked={setup.provider === k}
                  onChange={() => onChange(switchProvider(setup, k))}
                />
                <label htmlFor={`provider-${id}-${k}`}>{p.name}</label>
              </Fragment>
            ))}
          </div>
        </div>
        <div className="fields">
          <Field id={`${uid}-model`} label="Model" help={FIELD_HELP.model}>
            <select id={`${uid}-model`} name="model" value={setup.model} onChange={(e) => onChange(switchModel(setup, e.target.value))}>
              {modelsOf(setup.provider).map(([k, m]) => <option key={k} value={k}>{m.name}</option>)}
            </select>
          </Field>
          <Field id={`${uid}-cache`} label="Prompt cache" help={FIELD_HELP.cache}>
            <select id={`${uid}-cache`} name="cache" value={setup.cache} onChange={(e) => set({ cache: e.target.value as CacheId })}>
              {model.cache.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field id={`${uid}-effort`} label="Reasoning effort" help={FIELD_HELP.effort}>
            <select id={`${uid}-effort`} name="effort" value={setup.effort} onChange={(e) => set({ effort: e.target.value as Effort })}>
              {model.efforts.map((e) => (
                <option key={e} value={e}>{e === model.defaultEffort ? `${e} (default)` : e}</option>
              ))}
            </select>
          </Field>
          <Field id={`${uid}-reasoning`} label="Earlier reasoning in context" help={FIELD_HELP.reasoning}>
            <select id={`${uid}-reasoning`} name="reasoning" value={setup.reasoning} onChange={(e) => set({ reasoning: e.target.value as ReasoningMode })}>
              {reasoningOptions(model).map((r) => (
                <option key={r} value={r}>{r === reasoningDefault(model) ? `${r} (default)` : r}</option>
              ))}
            </select>
          </Field>
          <NumberField
            label="Cache breaking interruptions" help={FIELD_HELP.interruptions} name="interruptions" min={0} max={50} step={1}
            fallback={d.interruptions} value={setup.interruptions}
            onChange={(v) => set({ interruptions: Math.round(v) })}
          />
        </div>
      </div>
    </div>
  )
}

import { Fragment, useId } from 'react'
import { DEFAULT_SETUPS } from '../data/defaults'
import { FIELD_HELP } from '../data/fieldHelp'
import { MODELS, PROVIDERS, modelsOf, reasoningDefault, reasoningOptions } from '../data/pricing'
import { switchModel, switchProvider } from '../model/normalize'
import type { CacheId, Effort, Provider, ReasoningMode, Setup } from '../model/types'
import { Field } from './Field'
import { InfoTip } from './InfoTip'
import { NumberField } from './NumberField'

interface Props {
  id: 'A' | 'B'
  setup: Setup
  onChange: (next: Setup) => void
}

export function SetupPanel({ id, setup, onChange }: Props) {
  const uid = useId()
  const model = MODELS[setup.model]
  const d = DEFAULT_SETUPS[id]
  const set = (patch: Partial<Setup>) => onChange({ ...setup, ...patch })

  return (
    <fieldset className="setup" data-id={id}>
      <legend><span className="key" />Setup {id}</legend>
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
          label="Interruptions" help={FIELD_HELP.interruptions} name="interruptions" min={0} max={50} step={1}
          fallback={d.interruptions} value={setup.interruptions}
          onChange={(v) => set({ interruptions: Math.round(v) })}
        />
        <NumberField
          label="Pause per interruption (min)" help={FIELD_HELP.pause} name="pause" min={0} max={1440} step={1}
          fallback={d.pause} value={setup.pause}
          onChange={(v) => set({ pause: v })}
        />
      </div>
    </fieldset>
  )
}

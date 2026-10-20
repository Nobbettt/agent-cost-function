import { Fragment } from 'react'
import { DEFAULT_SETUPS } from '../data/defaults'
import { MODELS, PROVIDERS, modelsOf, reasoningDefault, reasoningOptions } from '../data/pricing'
import { switchModel, switchProvider } from '../model/normalize'
import type { CacheId, Effort, Provider, ReasoningMode, Setup } from '../model/types'
import { NumberField } from './NumberField'

interface Props {
  id: 'A' | 'B'
  setup: Setup
  onChange: (next: Setup) => void
}

export function SetupPanel({ id, setup, onChange }: Props) {
  const model = MODELS[setup.model]
  const d = DEFAULT_SETUPS[id]
  const set = (patch: Partial<Setup>) => onChange({ ...setup, ...patch })

  return (
    <fieldset className="setup" data-id={id}>
      <legend><span className="key" />Setup {id}</legend>
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
      <div className="fields">
        <label>
          Model
          <select name="model" value={setup.model} onChange={(e) => onChange(switchModel(setup, e.target.value))}>
            {modelsOf(setup.provider).map(([k, m]) => <option key={k} value={k}>{m.name}</option>)}
          </select>
        </label>
        <label>
          Prompt cache
          <select name="cache" value={setup.cache} onChange={(e) => set({ cache: e.target.value as CacheId })}>
            {model.cache.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label>
          Reasoning effort
          <select name="effort" value={setup.effort} onChange={(e) => set({ effort: e.target.value as Effort })}>
            {model.efforts.map((e) => (
              <option key={e} value={e}>{e === model.defaultEffort ? `${e} (default)` : e}</option>
            ))}
          </select>
        </label>
        <label>
          Earlier reasoning in context
          <select name="reasoning" value={setup.reasoning} onChange={(e) => set({ reasoning: e.target.value as ReasoningMode })}>
            {reasoningOptions(model).map((r) => (
              <option key={r} value={r}>{r === reasoningDefault(model) ? `${r} (default)` : r}</option>
            ))}
          </select>
        </label>
        <NumberField
          label="Interruptions" name="interruptions" min={0} max={50} step={1}
          fallback={d.interruptions} value={setup.interruptions}
          onChange={(v) => set({ interruptions: Math.round(v) })}
        />
        <NumberField
          label="Pause per interruption (min)" name="pause" min={0} max={1440} step={1}
          fallback={d.pause} value={setup.pause}
          onChange={(v) => set({ pause: v })}
        />
      </div>
    </fieldset>
  )
}

import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { CACHE_INFO, EXPLICIT_BREAK_NOTE, EXPLICIT_CHECKBOX_NOTE, EXPLICIT_HOURS_NOTE, EXPLICIT_UNAVAILABLE_NOTE } from '../data/cacheNotes'
import { DEFAULT_SETUPS } from '../data/defaults'
import { FIELD_HELP } from '../data/fieldHelp'
import { DEFAULT_EXPLICIT_HOURS, EXPLICIT_HOURS_LIMITS, INTERRUPTION_LIMITS } from '../data/limits'
import { MODELS, PROVIDERS, modelsOf, reasoningDefault, reasoningOptions } from '../data/pricing'
import { switchModel, switchProvider } from '../model/normalize'
import { MAX_NAME_LENGTH, cleanName, displayName, summarizeSetup, toggleExplicit, usesExplicitCache } from '../model/setups'
import type { CacheId, Effort, Provider, ReasoningMode, Setup } from '../model/types'
import { Chevron } from './Chevron'
import { Field } from './Field'
import { InfoTip } from './InfoTip'
import { NumberField } from './NumberField'
import { ReadOnlyField } from './ReadOnlyField'
import { SeriesKey } from './SeriesKey'

interface Props {
  setup: Setup
  expanded: boolean
  onToggle: () => void
  onChange: (next: Setup) => void
  /** Present only while removing is allowed (more than two setups). */
  onRemove?: () => void
}

const HIDDEN = { visibility: 'hidden' } as const

export function SetupPanel({ setup, expanded, onToggle, onChange, onRemove }: Props) {
  const { id } = setup
  const uid = useId()
  const model = MODELS[setup.model]
  const d = DEFAULT_SETUPS.A // fallback for the interruption fields; every default setup shares these
  const set = (patch: Partial<Setup>) => onChange({ ...setup, ...patch })
  const name = displayName(setup)
  const cacheInfo = CACHE_INFO[setup.cache]
  const explicit = usesExplicitCache(setup)

  // Renaming: the toggle becomes a text input in place. Enter or blur commits through cleanName, Esc cancels,
  // and focus goes back to the edit button (unless a blur moved it to another control on purpose).
  const [draft, setDraft] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const renameButton = useRef<HTMLButtonElement>(null)
  const refocus = useRef(false)
  const editing = draft !== null

  const finish = (commit: boolean, returnFocus = true) => {
    if (draft === null) return
    refocus.current = returnFocus
    setDraft(null)
    if (commit) onChange({ ...setup, name: cleanName(draft, id) })
  }
  useEffect(() => {
    if (editing) {
      input.current?.focus()
      input.current?.select()
    } else if (refocus.current) {
      refocus.current = false
      renameButton.current?.focus()
    }
  }, [editing])
  // Esc is taken in the capture phase, so it cancels the edit without also closing the drawer or a help tip.
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      finish(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  })

  const summary = !expanded && <span className="setup-summary">{summarizeSetup(setup)}</span>

  return (
    <div className="setup" role="group" aria-label={name} data-id={id}>
      <div className="setup-head">
        {editing ? (
          <div className="setup-toggle setup-editing" data-expanded={expanded}>
            <Chevron />
            <span className="setup-title">
              <SeriesKey id={id} />
              <input
                ref={input} className="setup-name-input" type="text" name={`name-${id}`} aria-label={`Name for setup ${id}`}
                maxLength={MAX_NAME_LENGTH} autoComplete="off" spellCheck={false} value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); finish(true) } }}
                onBlur={(e) => finish(true, !e.relatedTarget)}
              />
            </span>
            {summary}
          </div>
        ) : (
          <button
            type="button" id={`setup-${id}-toggle`} className="setup-toggle"
            aria-expanded={expanded} aria-controls={`setup-${id}-body`} onClick={onToggle}
          >
            <Chevron />
            <span className="setup-title">
              <SeriesKey id={id} />
              <span id={`setup-${id}-title`} className="setup-name">{name}</span>
            </span>
            {summary}
          </button>
        )}
        {/* Hidden, not removed, while editing, so the header keeps its width and the title does not reflow. */}
        <button
          ref={renameButton} type="button" className="setup-rename" aria-label={`Rename ${name}`}
          style={editing ? HIDDEN : undefined} onClick={() => setDraft(name)}
        >
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.8 2.2l2 2M2 10l.5-2.3L8.3 1.9a.7.7 0 0 1 1 0l.8.8a.7.7 0 0 1 0 1L4.3 9.5 2 10z" />
          </svg>
        </button>
        {onRemove && (
          <button type="button" className="setup-remove" aria-label={`Remove ${name}`} style={editing ? HIDDEN : undefined} onClick={onRemove}>
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
          <div className="toggle" role="radiogroup" aria-label={`Provider for ${name}`}>
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
          {/* One option means a read-only value (no tab stop); several, a select. The note follows the selected option. */}
          {model.cache.length === 1 ? (
            <ReadOnlyField id={`${uid}-cache`} label={cacheInfo.label} help={FIELD_HELP.cache} value={cacheInfo.fixedValue} note={cacheInfo.note} />
          ) : (
            <Field id={`${uid}-cache`} label={cacheInfo.label} help={FIELD_HELP.cache} note={cacheInfo.note}>
              <select id={`${uid}-cache`} name="cache" aria-describedby={`${uid}-cache-note`} value={setup.cache} onChange={(e) => set({ cache: e.target.value as CacheId })}>
                {model.cache.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Field>
          )}
          {model.provider === 'google' && (model.explicitStorage === undefined ? (
            <p className="field-note field-wide">{EXPLICIT_UNAVAILABLE_NOTE}</p>
          ) : (
            <div className="field">
              <label className="check" htmlFor={`${uid}-explicit`}>
                <input
                  id={`${uid}-explicit`} type="checkbox" name="explicit" aria-describedby={`${uid}-explicit-note`}
                  checked={explicit} onChange={(e) => onChange(toggleExplicit(setup, e.target.checked))}
                />
                Explicit cache for prompt + tools
              </label>
              <p className="field-note" id={`${uid}-explicit-note`}>{EXPLICIT_CHECKBOX_NOTE}</p>
            </div>
          ))}
          {explicit && (
            <NumberField
              label="Session duration (hours)" help={FIELD_HELP.explicitHours} name="explicit-hours" {...EXPLICIT_HOURS_LIMITS}
              fallback={DEFAULT_EXPLICIT_HOURS} value={setup.explicitHours ?? DEFAULT_EXPLICIT_HOURS} note={EXPLICIT_HOURS_NOTE}
              onChange={(v) => set({ explicitHours: v })}
            />
          )}
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
            label="Cache breaking interruptions" help={FIELD_HELP.interruptions} name="interruptions" {...INTERRUPTION_LIMITS} step={1}
            note={`${cacheInfo.breakNote}${explicit ? EXPLICIT_BREAK_NOTE : ''}`}
            fallback={d.interruptions} value={setup.interruptions}
            onChange={(v) => set({ interruptions: Math.round(v) })}
          />
        </div>
      </div>
    </div>
  )
}

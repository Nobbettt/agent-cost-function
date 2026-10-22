import { useId, useState } from 'react'
import { displayValue } from '../format'
import { clampValue } from '../model/normalize'
import { Field } from './Field'

interface Props {
  label: string
  /** Tip text for the "?" icon. */
  help: string
  name: string
  min: number
  max: number
  step: number
  /** What the "-" and "+" buttons move by, in the stored unit; they snap to multiples of it. Defaults to `step`. */
  clickStep?: number
  /** Used when the field is empty or not a number. */
  fallback: number
  value: number
  onChange: (value: number) => void
  /** Tokens per displayed unit (1000 shows and types thousands). `min`, `max`, `step`, `fallback`, `value` and `onChange` stay in the stored unit. */
  scale?: number
  /** A short note under the input. */
  note?: string
}

/** The next multiple of `by` above (dir 1) or below (dir -1) `value`, clamped to [min, max]; rounded so 0.1 and 0.5 steps carry no float noise. */
function snapStep(value: number, dir: 1 | -1, by: number, min: number, max: number): number {
  const ratio = value / by
  const nearest = Math.round(ratio)
  const onGrid = Math.abs(ratio - nearest) < 1e-9
  const k = dir === 1 ? (onGrid ? nearest + 1 : Math.ceil(ratio)) : (onGrid ? nearest - 1 : Math.floor(ratio))
  return Math.min(max, Math.max(min, +(k * by).toFixed(6)))
}

/**
 * Number input that shows what the user typed but reports a value clamped to [min, max]
 * (or `fallback` when empty or not a number). With `scale` the input shows and takes `scale`-sized units
 * (thousands of tokens), while the value, the limits and the clamping stay in the stored unit.
 */
export function NumberField({ label, help, name, min, max, step, clickStep = step, fallback, value, onChange, scale = 1, note }: Props) {
  const id = useId()
  const [text, setText] = useState(displayValue(value, scale))
  // Typed units to the stored unit (rounded to a whole number once scaled), then clamped there.
  const toStored = (typed: string) => {
    const n = Number(typed)
    if (scale === 1 || typed.trim() === '' || !Number.isFinite(n)) return typed
    return String(Math.round(n * scale))
  }
  const click = (dir: 1 | -1) => {
    const next = snapStep(value, dir, clickStep, min, max)
    setText(displayValue(next, scale))
    onChange(next)
  }
  const stepButton = (dir: 1 | -1) => (
    <button
      type="button" className="step-btn" onClick={() => click(dir)}
      aria-label={`${dir === 1 ? 'Increase' : 'Decrease'} ${label}`} disabled={dir === 1 ? value >= max : value <= min}
    >
      {dir === 1 ? '+' : '\u2212'}
    </button>
  )
  return (
    <Field id={id} label={label} help={help} note={note}>
      <div className="stepper">
        {stepButton(-1)}
        <input
          id={id}
          name={name}
          aria-describedby={note ? `${id}-note` : undefined}
          type="number"
          min={+(min / scale).toFixed(3)}
          max={+(max / scale).toFixed(3)}
          step={+(step / scale).toFixed(3)}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            onChange(clampValue(toStored(e.target.value), min, max, fallback))
          }}
        />
        {stepButton(1)}
      </div>
    </Field>
  )
}

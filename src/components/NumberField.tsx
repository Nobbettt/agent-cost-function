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
  /** Used when the field is empty or not a number. */
  fallback: number
  value: number
  onChange: (value: number) => void
  /** Tokens per displayed unit (1000 shows and types thousands). `min`, `max`, `step`, `fallback`, `value` and `onChange` stay in the stored unit. */
  scale?: number
}


/**
 * Number input that shows what the user typed but reports a value clamped to [min, max]
 * (or `fallback` when empty or not a number). With `scale` the input shows and takes `scale`-sized units
 * (thousands of tokens), while the value, the limits and the clamping stay in the stored unit.
 */
export function NumberField({ label, help, name, min, max, step, fallback, value, onChange, scale = 1 }: Props) {
  const id = useId()
  const [text, setText] = useState(displayValue(value, scale))
  // Typed units to the stored unit (rounded to a whole number once scaled), then clamped there.
  const toStored = (typed: string) => {
    const n = Number(typed)
    if (scale === 1 || typed.trim() === '' || !Number.isFinite(n)) return typed
    return String(Math.round(n * scale))
  }
  return (
    <Field id={id} label={label} help={help}>
      <input
        id={id}
        name={name}
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
    </Field>
  )
}

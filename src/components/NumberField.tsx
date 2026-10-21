import { useId, useState } from 'react'
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
}

/**
 * Number input that shows what the user typed but reports a value clamped to [min, max]
 * (or `fallback` when empty or not a number).
 */
export function NumberField({ label, help, name, min, max, step, fallback, value, onChange }: Props) {
  const id = useId()
  const [text, setText] = useState(String(value))
  return (
    <Field id={id} label={label} help={help}>
      <input
        id={id}
        name={name}
        type="number"
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onChange(clampValue(e.target.value, min, max, fallback))
        }}
      />
    </Field>
  )
}

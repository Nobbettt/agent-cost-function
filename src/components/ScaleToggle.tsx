import { useId } from 'react'
import type { YScale } from './chartConfig'

const OPTIONS: readonly { value: YScale; label: string }[] = [{ value: 'linear', label: 'Linear' }, { value: 'log', label: 'Log' }]

/** A compact segmented control for the y axis scale, styled like the provider toggle. */
export function ScaleToggle({ value, onChange }: { value: YScale; onChange: (next: YScale) => void }) {
  const name = useId()
  return (
    <div className="toggle compact" role="radiogroup" aria-label="Y axis scale">
      {OPTIONS.map((o) => (
        <span key={o.value} className="toggle-option">
          <input type="radio" name={name} id={`${name}-${o.value}`} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <label htmlFor={`${name}-${o.value}`}>{o.label}</label>
        </span>
      ))}
    </div>
  )
}

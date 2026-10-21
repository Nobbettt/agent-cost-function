import type { ReactNode } from 'react'
import { InfoTip } from './InfoTip'

interface Props {
  /** Id of the control, matched by the label's htmlFor. */
  id: string
  label: string
  help: string
  children: ReactNode
  /** A short note under the control; the control points at it with aria-describedby={`${id}-note`}. */
  note?: string
}

/** Label with its "?" tip on one row, then the control. The tip sits outside the <label> so clicking it never focuses the control. */
export function Field({ id, label, help, children, note }: Props) {
  return (
    <div className="field">
      <div className="field-head">
        <label htmlFor={id}>{label}</label>
        <InfoTip label={label} text={help} />
      </div>
      {children}
      {note && <p className="field-note" id={`${id}-note`}>{note}</p>}
    </div>
  )
}

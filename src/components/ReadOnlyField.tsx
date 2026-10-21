import { InfoTip } from './InfoTip'

interface Props {
  /** Id of the value box; the label and the note get `-label` and `-note` ids from it. */
  id: string
  label: string
  help: string
  value: string
  note?: string
}

/**
 * A setting with one possible value: the label with its "?" tip, then the value in a static box styled like a filled
 * input. Not a disabled select, so it adds no tab stop; the box is a group named by the label, so a screen reader says
 * e.g. "Cache lifetime, 30 min (fixed)".
 */
export function ReadOnlyField({ id, label, help, value, note }: Props) {
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label" id={`${id}-label`}>{label}</span>
        <InfoTip label={label} text={help} />
      </div>
      <div id={id} className="static-value" role="group" aria-labelledby={`${id}-label`} aria-describedby={note ? `${id}-note` : undefined}>{value}</div>
      {note && <p className="field-note" id={`${id}-note`}>{note}</p>}
    </div>
  )
}

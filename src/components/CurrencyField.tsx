import { useId } from 'react'
import { useCurrency } from '../currency/context'
import { FIELD_HELP } from '../data/fieldHelp'
import { CURRENCIES, isCurrencyCode } from '../data/fx'
import { Field } from './Field'

/**
 * The display-currency picker as a settings field, for screens too narrow for it in the navbar.
 * Always visible, outside the accordion; same context as the navbar select, so nothing else changes.
 */
export function CurrencyField() {
  const id = useId()
  const { currency, setCurrency, isAvailable } = useCurrency()
  return (
    <div className="currency-field">
      <Field id={id} label="Currency" help={FIELD_HELP.currency}>
        <select id={id} value={currency} onChange={(e) => isCurrencyCode(e.target.value) && setCurrency(e.target.value)}>
          {CURRENCIES.map((code) => (
            <option key={code} value={code} disabled={!isAvailable(code)}>{code}</option>
          ))}
        </select>
      </Field>
    </div>
  )
}

import { useCurrency } from '../currency/context'
import { FIELD_HELP } from '../data/fieldHelp'
import { CURRENCIES, isCurrencyCode } from '../data/fx'
import { InfoTip } from './InfoTip'

/** Compact display-currency picker for the navbar. Codes missing from the fetched rates are disabled. */
export function CurrencySelect() {
  const { currency, setCurrency, isAvailable } = useCurrency()
  return (
    <span className="currency-wrap">
      <label className="currency">
        <span className="currency-label">Currency</span>
        <select value={currency} onChange={(e) => isCurrencyCode(e.target.value) && setCurrency(e.target.value)}>
          {CURRENCIES.map((code) => (
            <option key={code} value={code} disabled={!isAvailable(code)}>{code}</option>
          ))}
        </select>
      </label>
      <InfoTip label="Currency" text={FIELD_HELP.currency} />
    </span>
  )
}

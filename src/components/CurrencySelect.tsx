import { CURRENCIES, isCurrencyCode } from '../data/fx'
import { useCurrency } from '../currency/context'

/** Compact display-currency picker for the navbar. Codes missing from the fetched rates are disabled. */
export function CurrencySelect() {
  const { currency, setCurrency, isAvailable } = useCurrency()
  return (
    <label className="currency">
      <span className="currency-label">Currency</span>
      <select value={currency} onChange={(e) => isCurrencyCode(e.target.value) && setCurrency(e.target.value)}>
        {CURRENCIES.map((code) => (
          <option key={code} value={code} disabled={!isAvailable(code)}>{code}</option>
        ))}
      </select>
    </label>
  )
}

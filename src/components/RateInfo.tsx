import { useCurrency } from '../currency/context'

/** Where the converted numbers come from: a small muted line below the tables, shown once a rate is in use. */
export function RateInfo() {
  const { currency, displayCurrency, rate, rateDate, status, stale } = useCurrency()
  if (currency === 'USD' || status !== 'ready') return null
  return (
    <p className="rate-info">
      Shown in {displayCurrency} at 1 USD = {rate} {displayCurrency} · ECB reference rate {rateDate} via{' '}
      <a href="https://frankfurter.dev" target="_blank" rel="noopener">Frankfurter</a>
      {stale ? " · couldn't refresh, showing the last known rate" : ''}
    </p>
  )
}

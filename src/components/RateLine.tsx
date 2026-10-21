import { useCurrency } from '../currency/context'

/** Small muted line under the headline explaining the conversion; nothing at all while showing USD. */
export function RateLine() {
  const { currency, displayCurrency, rate, rateDate, status, stale } = useCurrency()
  if (currency === 'USD') return null
  if (status === 'loading') return <p className="rate-line" role="status">Loading exchange rate…</p>
  if (status === 'error') return <p className="rate-line" role="status">Couldn&apos;t load exchange rates, showing USD.</p>
  return (
    <p className="rate-line">
      Shown in {displayCurrency} at 1 USD = {rate} {displayCurrency} · ECB reference rate {rateDate} via{' '}
      <a href="https://frankfurter.dev" target="_blank" rel="noopener">Frankfurter</a>
      {stale ? " · couldn't refresh, showing the last known rate" : ''}
    </p>
  )
}

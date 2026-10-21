import { useCurrency } from '../currency/context'

/**
 * Feedback right under the summary cards while a non-USD currency has no rate to show: loading, or failed
 * (the numbers are still USD). Renders nothing otherwise, so it never leaves an empty gap.
 */
export function RateStatus() {
  const { currency, status } = useCurrency()
  if (currency === 'USD') return null
  if (status === 'loading') return <p className="rate-status" role="status">Loading exchange rate…</p>
  if (status === 'error') return <p className="rate-status" role="status">Couldn&apos;t load exchange rates, showing USD.</p>
  return null
}

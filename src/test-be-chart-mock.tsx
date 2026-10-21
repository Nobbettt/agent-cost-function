import type { CurvePoint } from './model/breakEven'

/** Stands in for BreakEvenChart in jsdom (Chart.js does not run there) and exposes the props it would get. */
export function BreakEvenChartMock({ curve, exact, markerText, format, currency, rate }: {
  curve: readonly CurvePoint[]
  exact: number | null
  markerText: string
  format: (usd: number) => string
  currency: string
  rate: number
}) {
  return (
    <div
      data-testid="be-chart"
      data-count={curve.length}
      data-ks={curve.map((p) => p.k).join(',')}
      data-cost5={curve.map((p) => p.cost5.toFixed(4)).join(',')}
      data-cost1h={curve.map((p) => p.cost1h.toFixed(4)).join(',')}
      data-exact={exact === null ? 'none' : exact.toFixed(4)}
      data-marker={markerText}
      data-currency={currency}
      data-rate={rate}
      data-sample={format(1234.5)}
    />
  )
}

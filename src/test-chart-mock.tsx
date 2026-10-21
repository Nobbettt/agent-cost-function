import type { ChartSeries } from './components/chartConfig'

/** Stands in for CostChart in jsdom (Chart.js does not run there) and exposes the props it would get. */
export function CostChartMock({ series, metric, xMax, format, currency, rate }: {
  series: readonly ChartSeries[]
  metric: string
  xMax: number
  format: (usd: number) => string
  currency: string
  rate: number
}) {
  return (
    <div
      data-testid={`chart-${metric}`}
      data-xmax={xMax}
      data-ids={series.map((s) => s.id).join(',')}
      data-names={series.map((s) => s.name).join('|')}
      data-vars={series.map((s) => s.cssVar).join(',')}
      data-dashes={series.map((s) => s.dash.join(' ') || 'solid').join(',')}
      data-last={series.map((s) => s.run.points.at(-1)?.x).join(',')}
      data-currency={currency}
      data-rate={rate}
      data-sample={format(1234.5)}
    />
  )
}

import type { GridCell } from './model/breakEven'

/** Stands in for SavingsChart in jsdom (Chart.js does not run there) and exposes the props it would get. */
export function SavingsChartMock({ grid, lines, maxShort, yourShort, yourLong, currency, rate }: {
  grid: readonly GridCell[]
  lines: readonly number[]
  maxShort: number
  yourShort: number
  yourLong: number
  currency: string
  rate: number
}) {
  const row = (long: number) => grid.filter((c) => c.long === long)
  return (
    <div
      data-testid="savings-chart"
      data-lines={lines.join(',')}
      data-maxshort={maxShort}
      data-yourshort={yourShort}
      data-yourlong={yourLong}
      data-rows={new Set(grid.map((c) => c.long)).size}
      data-points={lines.map((l) => row(l).length).join(',')}
      data-first-savings={lines.map((l) => row(l)[0]?.saving.toFixed(4)).join(',')}
      data-currency={currency}
      data-rate={rate}
    />
  )
}

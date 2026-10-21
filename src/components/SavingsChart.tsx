import { Chart } from 'chart.js'
import { useEffect, useMemo, useRef } from 'react'
import { gridRows, type GridCell } from '../model/breakEven'
import { css, useColorScheme } from '../theme'
import { applyTheme } from './chartConfig'
import { lineLabel, savingsConfig, savingsLineStyle, type SavingsChartType } from './savingsChartConfig'

interface Props {
  grid: readonly GridCell[]
  /** The pauses-over-an-hour counts to draw a line for, ascending: 0 to 3, and the viewer's own when it is above 3. */
  lines: readonly number[]
  maxShort: number
  yourShort: number
  yourLong: number
  label: string
  /** Formats a USD amount in the display currency. */
  format: (usd: number) => string
  currency: string
  /** Units of `currency` per USD; savings are plotted in the display currency so the axis gets round ticks. */
  rate: number
}

/** What the 1 hour cache saves over the 5 minute cache as pauses of 5–60 min grow, one line per number of pauses over an hour. */
export function SavingsChart({ grid, lines, maxShort, yourShort, yourLong, label, format, currency, rate }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const chart = useRef<SavingsChartType | null>(null)
  const scheme = useColorScheme()
  const formatRef = useRef(format)
  const rateRef = useRef(rate)
  const rows = useMemo(() => new Map(gridRows(grid).map((r) => [r.long, r.cells])), [grid])

  useEffect(() => {
    const instance = new Chart(canvas.current!, savingsConfig(() => (plotted) => formatRef.current(plotted / rateRef.current)))
    chart.current = instance
    return () => {
      instance.destroy()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    const c = chart.current
    if (!c) return
    c.data.datasets = lines.map((long, i) => {
      const style = savingsLineStyle(i, long, yourLong)
      return {
        label: lineLabel(long),
        data: (rows.get(long) ?? []).map((cell) => ({ x: cell.short, y: cell.saving * rate })),
        borderColor: css(style.colorVar),
        borderWidth: style.width,
        borderDash: style.dash,
        tension: 0,
        pointRadius: (ctx: { dataIndex: number }) => (long === yourLong && ctx.dataIndex === yourShort ? 5 : 0),
        pointBackgroundColor: css(style.colorVar),
        pointBorderColor: css('--surface'),
        pointBorderWidth: 2, pointHoverRadius: 4, pointHitRadius: 12,
      }
    })
    c.options.scales!.x!.max = maxShort
    formatRef.current = format
    rateRef.current = rate
    const yTitle = c.options.scales!.y!.title
    if (yTitle) yTitle.text = `1 hour cache saves (${currency})`
    applyTheme(c)
    // The zero line is the one that matters: a 1px gridline in the stronger ink.
    const y = c.options.scales!.y!
    y.grid = { color: (ctx) => (ctx.tick?.value === 0 ? css('--ink-2') : css('--grid')) }
    c.update()
  }, [rows, lines, maxShort, yourShort, yourLong, scheme, format, currency, rate])

  return (
    <div className="chart-box">
      <canvas ref={canvas} aria-label={label} role="img" />
    </div>
  )
}

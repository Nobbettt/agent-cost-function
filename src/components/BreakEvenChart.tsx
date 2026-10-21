import { Chart } from 'chart.js'
import { useEffect, useRef } from 'react'
import { css, useColorScheme } from '../theme'
import type { CurvePoint } from '../model/breakEven'
import { applyTheme } from './chartConfig'
import { breakEvenConfig, makeBreakEvenDataset, type BreakEvenChartType } from './breakEvenChartConfig'

interface Props {
  curve: readonly CurvePoint[]
  /** Where the two costs meet, or null when they do not within the curve. */
  exact: number | null
  /** Text of the break-even marker, e.g. "break-even ≈ 1.3". */
  markerText: string
  label: string
  /** Formats a USD amount in the display currency (ticks, tooltips, end labels). */
  format: (usd: number) => string
  currency: string
  /** Units of `currency` per USD. Points are plotted in the display currency so the axis gets round ticks. */
  rate: number
}

/** Session cost against the number of interruptions, for the 5 minute and the 1 hour cache. */
export function BreakEvenChart({ curve, exact, markerText, label, format, currency, rate }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const chart = useRef<BreakEvenChartType | null>(null)
  const scheme = useColorScheme()
  const formatRef = useRef(format)
  const rateRef = useRef(rate)

  useEffect(() => {
    const instance = new Chart(canvas.current!, breakEvenConfig(() => (plotted) => formatRef.current(plotted / rateRef.current)))
    chart.current = instance
    return () => {
      instance.destroy()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    const c = chart.current
    if (!c) return
    if (c.data.datasets.length === 0) c.data.datasets.push(makeBreakEvenDataset('5 min cache', true), makeBreakEvenDataset('1 hour cache', false))
    const [five, hour] = c.data.datasets
    five.borderColor = css('--series-a')
    hour.borderColor = css('--series-b')
    five.data = curve.map((p) => ({ x: p.k, y: p.cost5 * rate }))
    hour.data = curve.map((p) => ({ x: p.k, y: p.cost1h * rate }))
    c.options.scales!.x!.max = curve.at(-1)?.k ?? 0
    formatRef.current = format
    rateRef.current = rate
    const yTitle = c.options.scales!.y!.title
    if (yTitle) yTitle.text = currency
    c.options.plugins!.breakEven = { x: exact, text: markerText }
    applyTheme(c)
    c.update()
  }, [curve, exact, markerText, scheme, format, currency, rate])

  return (
    <div className="chart-box">
      <canvas ref={canvas} aria-label={label} role="img" />
    </div>
  )
}

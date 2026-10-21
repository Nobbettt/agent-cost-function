import { Chart } from 'chart.js'
import { useEffect, useRef } from 'react'
import { css, useColorScheme } from '../theme'
import { applyTheme, lineConfig, makeDataset, type ChartPoint, type ChartSeries } from './chartConfig'

interface Props {
  /** One line per setup: colour, dash and run. The chart follows the list as setups come and go. */
  series: readonly ChartSeries[]
  metric: 'cum' | 'req'
  /** Right edge of the x axis (the session length). */
  xMax: number
  endLabels?: boolean
  label: string
  /** Formats a USD amount in the display currency (ticks, tooltips, end labels). */
  format: (usd: number) => string
  /** Display currency code, used as the y-axis title. */
  currency: string
  /** Units of `currency` per USD. Points are plotted in the display currency so the axis gets round ticks. */
  rate: number
}

export function CostChart({ series, metric, xMax, endLabels = false, label, format, currency, rate }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const chart = useRef<Chart<'line', ChartPoint[]> | null>(null)
  const scheme = useColorScheme()
  const formatRef = useRef(format)
  const rateRef = useRef(rate)

  // Create once; destroy on unmount. endLabels is fixed per chart instance.
  useEffect(() => {
    const instance = new Chart(canvas.current!, lineConfig(endLabels, () => (plotted) => formatRef.current(plotted / rateRef.current)))
    chart.current = instance
    return () => {
      instance.destroy()
      chart.current = null
    }
  }, [endLabels])

  // Update data and theme whenever inputs or the colour scheme change.
  useEffect(() => {
    const c = chart.current
    if (!c) return
    // Sync the datasets with the series: update in place, add what is new, drop what is gone.
    // The array methods are the ones Chart.js watches, so it rebuilds its metasets itself.
    series.forEach((s, i) => {
      let ds = c.data.datasets[i]
      if (!ds) {
        c.data.datasets.push(makeDataset(s.id))
        ds = c.data.datasets[i]
      }
      ds.label = `Setup ${s.id}`
      ds.borderColor = css(s.cssVar)
      ds.borderDash = [...s.dash]
      ds.data = s.run.points.map((p) => ({ ...p, y: p[metric] * rate }))
    })
    c.data.datasets.splice(series.length)
    c.options.scales!.x!.max = xMax
    formatRef.current = format
    rateRef.current = rate
    const yTitle = c.options.scales!.y!.title
    if (yTitle) yTitle.text = currency
    applyTheme(c)
    c.update()
  }, [series, metric, xMax, scheme, endLabels, format, currency, rate])

  return (
    <div className="chart-box">
      <canvas ref={canvas} aria-label={label} role="img" />
    </div>
  )
}

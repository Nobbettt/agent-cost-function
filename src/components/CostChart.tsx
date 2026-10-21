import { Chart } from 'chart.js'
import { useEffect, useRef } from 'react'
import { css, useColorScheme } from '../theme'
import { applyTheme, lineConfig, makeDataset, type ChartPoint, type ChartSeries, type YScale } from './chartConfig'

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
  /** The y axis: linear (default) or logarithmic. */
  scale?: YScale
}

/** The y axis options this component changes (the typed union does not allow `type` to be reassigned). */
interface YAxisOptions {
  type: 'linear' | 'logarithmic'
  beginAtZero: boolean
  ticks?: { autoSkip?: boolean }
  title?: { text?: string }
}

export function CostChart({ series, metric, xMax, endLabels = false, label, format, currency, rate, scale = 'linear' }: Props) {
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
      ds.label = s.name
      ds.borderColor = css(s.cssVar)
      ds.borderDash = [...s.dash]
      // A log axis cannot show zero or less (never expected here): null makes Chart.js skip the point.
      ds.data = s.run.points.map((p) => {
        const y = p[metric] * rate
        return { ...p, y: scale === 'log' && !(y > 0) ? null : y }
      })
    })
    c.data.datasets.splice(series.length)
    c.options.scales!.x!.max = xMax
    formatRef.current = format
    rateRef.current = rate
    // Changing the axis type makes Chart.js rebuild that scale on update; the chart itself is kept.
    const y = c.options.scales!.y as YAxisOptions
    y.type = scale === 'log' ? 'logarithmic' : 'linear'
    y.beginAtZero = scale === 'linear'
    // Log ticks are 1 to 9 per decade, most of them unlabelled: auto-skipping would drop the labelled ones.
    if (y.ticks) y.ticks.autoSkip = scale === 'linear'
    const yTitle = y.title
    if (yTitle) yTitle.text = scale === 'log' ? `${currency} (log scale)` : currency
    applyTheme(c)
    c.update()
  }, [series, metric, xMax, scheme, endLabels, format, currency, rate, scale])

  return (
    <div className="chart-box">
      <canvas ref={canvas} aria-label={label} role="img" />
    </div>
  )
}

import { Chart } from 'chart.js'
import { useEffect, useRef } from 'react'
import type { Run } from '../model/types'
import { useColorScheme } from '../theme'
import { applyTheme, lineConfig, type ChartPoint } from './chartConfig'

interface Props {
  runs: readonly [Run, Run]
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

export function CostChart({ runs, metric, xMax, endLabels = false, label, format, currency, rate }: Props) {
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
    runs.forEach((r, i) => {
      c.data.datasets[i].data = r.points.map((p) => ({ ...p, y: p[metric] * rate }))
    })
    c.options.scales!.x!.max = xMax
    formatRef.current = format
    rateRef.current = rate
    const yTitle = c.options.scales!.y!.title
    if (yTitle) yTitle.text = currency
    applyTheme(c)
    c.update()
  }, [runs, metric, xMax, scheme, endLabels, format, currency, rate])

  return (
    <div className="chart-box">
      <canvas ref={canvas} aria-label={label} role="img" />
    </div>
  )
}

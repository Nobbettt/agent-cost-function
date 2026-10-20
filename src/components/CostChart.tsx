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
}

export function CostChart({ runs, metric, xMax, endLabels = false, label }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const chart = useRef<Chart<'line', ChartPoint[]> | null>(null)
  const scheme = useColorScheme()

  // Create once; destroy on unmount. endLabels is fixed per chart instance.
  useEffect(() => {
    const instance = new Chart(canvas.current!, lineConfig(endLabels))
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
      c.data.datasets[i].data = r.points.map((p) => ({ ...p, y: p[metric] }))
    })
    c.options.scales!.x!.max = xMax
    applyTheme(c)
    c.update()
  }, [runs, metric, xMax, scheme, endLabels])

  return (
    <div className="chart-box">
      <canvas ref={canvas} aria-label={label} role="img" />
    </div>
  )
}

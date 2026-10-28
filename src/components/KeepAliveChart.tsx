import { Chart, type ChartConfiguration, type ChartType, type Plugin } from 'chart.js'
import { useEffect, useRef } from 'react'
import { everyOtherTickLabel, fmtDuration } from '../format'
import type { KeepAlivePoint } from '../model/keepAlive'
import { css, useColorScheme } from '../theme'
import { applyTheme, crosshair, legendLabels } from './chartConfig'

interface XY { x: number; y: number }
type KeepAliveChartType = Chart<'line', XY[]>

declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    stopLine?: { x: number | null; text: string }
  }
}

const COLORS = { keep: '--pole-1h', die: '--pole-5m' } as const

/** A dashed vertical hairline where pinging stops paying, labelled at the top (right of the line if it fits, else left). */
const stopLine: Plugin<'line', { x: number | null; text: string }> = {
  id: 'stopLine',
  afterDatasetsDraw(chart, _args, opts) {
    if (opts.x === null || opts.x === undefined) return
    const { ctx, chartArea: { top, bottom, right } } = chart
    const px = chart.scales.x.getPixelForValue(opts.x)
    ctx.save()
    ctx.strokeStyle = css('--ink-2')
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(px, top)
    ctx.lineTo(px, bottom)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = '600 12px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = css('--ink-2')
    ctx.textBaseline = 'top'
    const onRight = px + 6 + ctx.measureText(opts.text).width <= right
    ctx.textAlign = onRight ? 'left' : 'right'
    ctx.fillText(opts.text, onRight ? px + 6 : px - 6, top + 4)
    ctx.restore()
  },
}

const dataset = (label: string) => ({ label, data: [] as XY[], borderWidth: 2, stepped: 'after' as const, pointRadius: 0, pointHitRadius: 12 })

function config(getFormat: () => (plotted: number) => string): ChartConfiguration<'line', XY[]> {
  return {
    type: 'line',
    data: { datasets: [dataset('Keep pinging'), dataset('Let it die')] },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'nearestPerDataset', intersect: false },
      scales: {
        x: { type: 'linear', min: 0, title: { display: true, text: 'Hours since your last message' } },
        y: { beginAtZero: true, ticks: { callback: (v, i) => everyOtherTickLabel(Number(v), i, getFormat()) }, title: { display: true, text: 'USD' } },
      },
      plugins: {
        stopLine: { x: null, text: '' },
        legend: { align: 'start', labels: { usePointStyle: true, pointStyle: 'line', pointStyleWidth: 16, boxWidth: 16, generateLabels: legendLabels } },
        tooltip: {
          callbacks: {
            title: (items) => `Back after ${fmtDuration((items[0].parsed.x as number) * 60)}`,
            label: (it) => `${getFormat()(it.parsed.y as number)}  ${it.dataset.label}`,
            labelColor: (it) => ({ borderColor: it.dataset.borderColor as string, backgroundColor: it.dataset.borderColor as string }),
          },
          boxHeight: 2, boxWidth: 12,
        },
      },
    },
    plugins: [crosshair as Plugin<'line'>, stopLine as Plugin<'line'>],
  }
}

interface Props {
  curve: readonly KeepAlivePoint[]
  /** Minutes after the last message where pinging stops paying. */
  stopAt: number
  label: string
  /** Formats a USD amount in the display currency. */
  format: (usd: number) => string
  currency: string
  /** Units of `currency` per USD; points are plotted in the display currency. */
  rate: number
}

/** What pinging has cost by the time you come back, against the re-write you pay once the cache has died. */
export function KeepAliveChart({ curve, stopAt, label, format, currency, rate }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const chart = useRef<KeepAliveChartType | null>(null)
  const scheme = useColorScheme()
  const formatRef = useRef(format)
  const rateRef = useRef(rate)

  useEffect(() => {
    const instance = new Chart(canvas.current!, config(() => (plotted) => formatRef.current(plotted / rateRef.current)))
    chart.current = instance
    return () => {
      instance.destroy()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    const c = chart.current
    if (!c) return
    const [keep, die] = c.data.datasets
    keep.borderColor = css(COLORS.keep)
    die.borderColor = css(COLORS.die)
    keep.data = curve.map((p) => ({ x: p.minutes / 60, y: p.keep * rate }))
    die.data = curve.map((p) => ({ x: p.minutes / 60, y: p.die * rate }))
    c.options.scales!.x!.max = (curve.at(-1)?.minutes ?? 0) / 60
    formatRef.current = format
    rateRef.current = rate
    const yTitle = c.options.scales!.y!.title
    if (yTitle) yTitle.text = currency
    c.options.plugins!.stopLine = { x: stopAt / 60, text: `stop pinging ≈ ${fmtDuration(stopAt)}` }
    applyTheme(c)
    c.update()
  }, [curve, stopAt, scheme, format, currency, rate])

  return (
    <div className="chart-box">
      <canvas ref={canvas} aria-label={label} role="img" />
    </div>
  )
}

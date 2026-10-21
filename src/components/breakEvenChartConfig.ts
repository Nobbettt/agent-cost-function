import type { Chart, ChartConfiguration, ChartType, Plugin } from 'chart.js'
import { everyOtherTickLabel } from '../format'
import { css } from '../theme'
import { crosshair, legendLabels, makeEndLabels } from './chartConfig'

declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    breakEven?: { x: number | null; text: string }
    yourPauses?: { x: number | null; text: string }
  }
}

/** The CSS colour of each line: the 5 minute cache is the 5 min pole, the 1 hour cache the 1 hour pole, as on the decision map. */
export const LINE_COLORS = { five: '--pole-5m', hour: '--pole-1h' } as const

/** One plotted point: interruptions on x, session cost (display currency) on y. */
export interface BreakEvenPoint { x: number; y: number }
export type BreakEvenChartType = Chart<'line', BreakEvenPoint[]>

/** A dashed vertical hairline where the two caches cost the same, labelled at the top. */
const breakEvenLine: Plugin<'line', { x: number | null; text: string }> = {
  id: 'breakEven',
  afterDatasetsDraw(chart, _args, opts) {
    if (opts.x === null || opts.x === undefined) return
    const { ctx, chartArea: { top, bottom, right } } = chart
    const px = chart.scales.x.getPixelForValue(opts.x)
    ctx.save()
    ctx.strokeStyle = css('--ink-2')
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(px, top)
    ctx.lineTo(px, bottom)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = '600 12px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = css('--ink-2')
    ctx.textBaseline = 'top'
    // The label goes right of the line if it fits and does not run into the "your pauses" line, else left of it, else the
    // shortened "≈ 1.3" in the same two places; if nothing fits, the full label on the right.
    const { left } = chart.chartArea
    const x = chart.options.plugins?.yourPauses?.x
    const yoursPx = x === null || x === undefined ? null : chart.scales.x.getPixelForValue(x)
    const short = opts.text.replace('break-even ', '')
    const candidates = [opts.text, short].flatMap((text) => {
      const width = ctx.measureText(text).width
      return [{ text, from: px + 6, to: px + 6 + width, align: 'left' as const }, { text, from: px - 6 - width, to: px - 6, align: 'right' as const }]
    })
    const fits = (c: (typeof candidates)[number]) => c.from >= left && c.to <= right && (yoursPx === null || yoursPx < c.from - 2 || yoursPx > c.to + 2)
    const pick = candidates.find(fits) ?? candidates[0]
    ctx.textAlign = pick.align
    ctx.fillText(pick.text, pick.align === 'left' ? pick.from : pick.to, top + 4)
    ctx.restore()
  },
}

/** The chosen number of short pauses: a dotted hairline labelled near the bottom, and a highlighted point on each line. */
const yourPauses: Plugin<'line', { x: number | null; text: string }> = {
  id: 'yourPauses',
  afterDatasetsDraw(chart, _args, opts) {
    if (opts.x === null || opts.x === undefined) return
    const { ctx, chartArea: { top, bottom, left, right } } = chart
    const px = chart.scales.x.getPixelForValue(opts.x)
    ctx.save()
    ctx.strokeStyle = css('--ink')
    ctx.lineWidth = 1
    ctx.setLineDash([1, 3])
    ctx.beginPath()
    ctx.moveTo(px, top)
    ctx.lineTo(px, bottom)
    ctx.stroke()
    ctx.setLineDash([])
    chart.data.datasets.forEach((ds, i) => {
      const point = chart.getDatasetMeta(i).data[opts.x as number]
      if (!point) return
      ctx.beginPath()
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2)
      ctx.fillStyle = ds.borderColor as string
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = css('--surface')
      ctx.stroke()
    })
    ctx.font = '600 12px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = css('--ink')
    ctx.textBaseline = 'bottom'
    const width = ctx.measureText(opts.text).width
    const onRight = px + 8 + width <= right || px - 8 - width < left
    ctx.textAlign = onRight ? 'left' : 'right'
    ctx.fillText(opts.text, onRight ? px + 8 : px - 8, bottom - 4)
    ctx.restore()
  },
}

/** A dataset for one cache; colour and points are filled in by the chart component on every update. */
export const makeBreakEvenDataset = (label: string, markers: boolean) => ({
  label, data: [] as BreakEvenPoint[], borderWidth: 2, tension: 0,
  pointRadius: markers ? 3 : 0,
  pointBackgroundColor: (c: { dataset: { borderColor?: unknown } }) => c.dataset.borderColor as string,
  pointBorderColor: () => css('--surface'),
  pointBorderWidth: 2, pointHoverRadius: 4, pointHitRadius: 12,
})

/** `getFormat` formats a plotted (display-currency) value; it is read at draw time, so the currency can change without rebuilding the chart. */
export function breakEvenConfig(getFormat: () => (usd: number) => string): ChartConfiguration<'line', BreakEvenPoint[]> {
  const plural = (n: number) => `${n} pause${n === 1 ? '' : 's'} of 5–60 min`
  return {
    type: 'line',
    data: { datasets: [] },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'nearestPerDataset', intersect: false },
      layout: { padding: { right: 72 } },
      scales: {
        x: { type: 'linear', min: 0, ticks: { precision: 0, maxTicksLimit: 21 },
             title: { display: true, text: 'Pauses of 5–60 min' } },
        y: { beginAtZero: true, ticks: { callback: (v, i) => everyOtherTickLabel(Number(v), i, getFormat()) }, title: { display: true, text: 'USD' } },
      },
      plugins: {
        // On a narrow chart the labels would leave no room for the lines; the legend names them.
        endLabels: { enabled: true, minWidth: 520 },
        breakEven: { x: null, text: '' },
        yourPauses: { x: null, text: '' },
        legend: { align: 'start', labels: { usePointStyle: true, pointStyle: 'line', pointStyleWidth: 16, boxWidth: 16, generateLabels: legendLabels } },
        tooltip: {
          callbacks: {
            title: (items) => plural(items[0].parsed.x as number),
            label: (it) => `${getFormat()(it.parsed.y as number)}  ${it.dataset.label}`,
            labelColor: (it) => ({ borderColor: it.dataset.borderColor as string, backgroundColor: it.dataset.borderColor as string }),
          },
          boxHeight: 2, boxWidth: 12,
        },
      },
    },
    plugins: [crosshair as Plugin<'line'>, makeEndLabels(getFormat) as Plugin<'line'>, breakEvenLine as Plugin<'line'>, yourPauses as Plugin<'line'>],
  }
}

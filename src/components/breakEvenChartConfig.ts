import type { Chart, ChartConfiguration, ChartType, Plugin } from 'chart.js'
import { everyOtherTickLabel } from '../format'
import { css } from '../theme'
import { crosshair, legendLabels, makeEndLabels } from './chartConfig'

declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    breakEven?: { x: number | null; text: string }
  }
}

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
    // To the right of the line, else to its left; on a plot too narrow for either, just "≈ 1.3".
    const { left } = chart.chartArea
    let text = opts.text
    let width = ctx.measureText(text).width
    if (px + 6 + width > right && px - 6 - width < left) {
      text = text.replace('break-even ', '')
      width = ctx.measureText(text).width
    }
    const onRight = px + 6 + width <= right
    ctx.textAlign = onRight ? 'left' : 'right'
    ctx.fillText(text, onRight ? px + 6 : px - 6, top + 4)
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
  const plural = (n: number) => `${n} interruption${n === 1 ? '' : 's'}`
  return {
    type: 'line',
    data: { datasets: [] },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'nearestPerDataset', intersect: false },
      layout: { padding: { right: 72 } },
      scales: {
        x: { type: 'linear', min: 0, ticks: { precision: 0, maxTicksLimit: 21 },
             title: { display: true, text: 'Interruptions (each a pause of 5 to 60 minutes)' } },
        y: { beginAtZero: true, ticks: { callback: (v, i) => everyOtherTickLabel(Number(v), i, getFormat()) }, title: { display: true, text: 'USD' } },
      },
      plugins: {
        // On a narrow chart the labels would leave no room for the lines; the legend names them.
        endLabels: { enabled: true, minWidth: 520 },
        breakEven: { x: null, text: '' },
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
    plugins: [crosshair as Plugin<'line'>, makeEndLabels(getFormat) as Plugin<'line'>, breakEvenLine as Plugin<'line'>],
  }
}

import type { Chart, ChartConfiguration, ChartType, Plugin } from 'chart.js'
import { css } from '../theme'
import { crosshair, legendLabels } from './chartConfig'
import type { BreakEvenPoint } from './breakEvenChartConfig'

declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    savingsZones?: { above: string; below: string }
  }
}

export type SavingsChartType = Chart<'line', BreakEvenPoint[]>

/** A hex colour as rgba(), for the very light zone fills. */
export function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Above zero the 1 hour cache is cheaper (a very light tint of the 1 hour pole), below it the 5 minute cache is (the same of the 5 min pole); each zone is labelled. */
const savingsZones: Plugin<'line', { above: string; below: string }> = {
  id: 'savingsZones',
  beforeDatasetsDraw(chart, _args, opts) {
    const { ctx, chartArea: { top, bottom, left, right }, scales: { y } } = chart
    const zero = Math.min(bottom, Math.max(top, y.getPixelForValue(0)))
    ctx.save()
    ctx.fillStyle = hexAlpha(css('--pole-1h'), 0.08)
    ctx.fillRect(left, top, right - left, zero - top)
    ctx.fillStyle = hexAlpha(css('--pole-5m'), 0.08)
    ctx.fillRect(left, zero, right - left, bottom - zero)
    ctx.font = '600 12px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = css('--ink-2')
    // The lines climb from the lower left to the upper right, so the empty corners are the upper left and the lower right.
    if (zero - top > 20) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(opts.above, left + 8, top + 6) }
    if (bottom - zero > 20) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(opts.below, right - 8, bottom - 6) }
    ctx.restore()
  },
}

/** `getFormat` formats a plotted (display-currency) amount; read at draw time so the currency can change without rebuilding the chart. */
export function savingsConfig(getFormat: () => (usd: number) => string): ChartConfiguration<'line', BreakEvenPoint[]> {
  const signed = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${getFormat()(Math.abs(v))}`
  return {
    type: 'line',
    data: { datasets: [] },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'nearestPerDataset', intersect: false },
      layout: { padding: { right: 12 } },
      scales: {
        x: { type: 'linear', min: 0, ticks: { precision: 0, maxTicksLimit: 21 }, title: { display: true, text: 'Pauses of 5–60 min' } },
        y: { beginAtZero: true, ticks: { callback: (v) => signed(Number(v)) }, title: { display: true, text: '1 hour cache saves' } },
      },
      plugins: {
        savingsZones: { above: '1 hour cache cheaper', below: '5 min cache cheaper' },
        legend: { align: 'start', labels: { usePointStyle: true, pointStyle: 'line', pointStyleWidth: 16, boxWidth: 16, generateLabels: legendLabels } },
        tooltip: {
          callbacks: {
            title: (items) => `${items[0].parsed.x} pause${items[0].parsed.x === 1 ? '' : 's'} of 5–60 min`,
            label: (it) => `${signed(it.parsed.y as number)}  ${it.dataset.label}`,
            labelColor: (it) => ({ borderColor: it.dataset.borderColor as string, backgroundColor: it.dataset.borderColor as string }),
          },
          boxHeight: 2, boxWidth: 12,
        },
      },
    },
    plugins: [savingsZones as Plugin<'line'>, crosshair as Plugin<'line'>],
  }
}

/** The label of a line: "0 pauses over 60 min", "1 pause over 60 min". */
export const lineLabel = (long: number): string => `${long} pause${long === 1 ? '' : 's'} over 60 min`

/** The 4th and 5th line also differ by dash, so the order is never carried by colour alone. */
const DASHES: readonly (readonly number[])[] = [[], [], [], [6, 3], [2, 3]]

/** Colour (a step of the 1 hour ramp, light to dark with more pauses), width (3px for the viewer's own line) and dash of the i-th line. */
export const savingsLineStyle = (i: number, long: number, yourLong: number): { colorVar: string; width: number; dash: number[] } => ({
  colorVar: `--ramp-1h-${i + 1}`,
  width: long === yourLong ? 3 : 2,
  dash: [...(DASHES[i] ?? [])],
})

import {
  Chart, Interaction, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip,
  type ChartConfiguration, type ChartType, type InteractionItem, type InteractionModeFunction, type Plugin,
} from 'chart.js'
import { fmtTokens } from '../format'
import type { Point } from '../model/types'
import { css } from '../theme'

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Legend)
Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif'

declare module 'chart.js' {
  interface InteractionModeMap {
    nearestPerDataset: InteractionModeFunction
  }
  interface PluginOptionsByType<TType extends ChartType> {
    endLabels?: { enabled: boolean }
  }
}

/** A plotted point: the simulation point plus the y value of the chosen metric. */
export type ChartPoint = Point & { y: number }
type LineChart = Chart<'line', ChartPoint[]>

const crosshair: Plugin<'line'> = {
  id: 'crosshair',
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements()
    if (!active?.length) return
    const { ctx, chartArea: { top, bottom } } = chart
    ctx.save()
    ctx.strokeStyle = css('--axis')
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(active[0].element.x, top)
    ctx.lineTo(active[0].element.x, bottom)
    ctx.stroke()
    ctx.restore()
  },
}

// Direct labels at each line's end; nudged apart when they would overlap.
// The formatter is closed over, not passed as a plugin option: Chart.js would treat a function option as
// scriptable and call it with its own context.
const makeEndLabels = (getFormat: () => (usd: number) => string): Plugin<'line', { enabled: boolean }> => ({
  id: 'endLabels',
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts.enabled) return
    const format = getFormat()
    const { ctx, chartArea } = chart
    const labels = (chart as LineChart).data.datasets.map((ds, i) => {
      const last = chart.getDatasetMeta(i).data.at(-1)
      return last && { x: last.x, y: Math.max(last.y, chartArea.top + 6), text: `${ds.label?.slice(-1)} ${format(ds.data.at(-1)?.y ?? 0)}` }
    }).filter((l) => !!l).sort((a, b) => a.y - b.y)
    labels.forEach((l, i) => { if (i && l.y - labels[i - 1].y < 14) l.y = labels[i - 1].y + 14 })
    ctx.save()
    ctx.font = '600 12px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = css('--ink-2')
    ctx.textBaseline = 'middle'
    for (const l of labels) ctx.fillText(l.text, l.x + 8, l.y)
    ctx.restore()
  },
})

// The two setups can have different x positions (reasoning kept in context changes the step),
// so the tooltip picks each dataset's point nearest the pointer instead of matching by index.
const nearestPerDataset: InteractionModeFunction = (chart, e) => {
  const x = chart.scales.x.getValueForPixel(e.x as number) ?? 0
  return (chart as LineChart).data.datasets.flatMap((ds, datasetIndex): InteractionItem[] => {
    if (!ds.data.length || x > ds.data.at(-1)!.x + chart.scales.x.max * 0.01) return []
    let index = 0
    ds.data.forEach((p, i) => { if (Math.abs(p.x - x) < Math.abs(ds.data[index].x - x)) index = i })
    return [{ element: chart.getDatasetMeta(datasetIndex).data[index], datasetIndex, index }]
  })
}
Interaction.modes.nearestPerDataset = nearestPerDataset

const raw = (c: { raw: unknown }) => c.raw as ChartPoint | undefined

/** `getFormat` formats a plotted (display-currency) value; it is read at draw time, so the currency can change without rebuilding the chart. */
export function lineConfig(showEndLabels: boolean, getFormat: () => (usd: number) => string): ChartConfiguration<'line', ChartPoint[]> {
  const dataset = (label: string) => ({
    label, data: [] as ChartPoint[], borderWidth: 2, tension: 0,
    pointRadius: (c: { raw: unknown }) => (raw(c)?.paused ? 4 : 0),
    pointBackgroundColor: (c: { raw: unknown; dataset: { borderColor?: unknown } }) =>
      raw(c)?.miss ? (c.dataset.borderColor as string) : css('--surface'),
    pointBorderColor: (c: { raw: unknown; dataset: { borderColor?: unknown } }) =>
      raw(c)?.miss ? css('--surface') : (c.dataset.borderColor as string),
    pointBorderWidth: 2, pointHoverRadius: 4, pointHitRadius: 12,
  })
  return {
    type: 'line',
    data: { datasets: [dataset('Setup A'), dataset('Setup B')] },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'nearestPerDataset', intersect: false },
      layout: { padding: { right: showEndLabels ? 72 : 0 } },
      scales: {
        x: { type: 'linear', min: 0, ticks: { callback: (v) => fmtTokens(Number(v)), maxTicksLimit: 11 },
             title: { display: true, text: 'Context size (tokens)' } },
        y: { beginAtZero: true, ticks: { callback: (v) => getFormat()(Number(v)) }, title: { display: true, text: 'USD' } },
      },
      plugins: {
        endLabels: { enabled: showEndLabels },
        legend: { align: 'start', labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 16 } },
        tooltip: {
          callbacks: {
            title: (items) => `${fmtTokens(items[0].parsed.x as number)} tokens in context`,
            label: (it) => `${getFormat()(it.parsed.y as number)}  ${it.dataset.label}`,
            afterLabel: (it) => (it.raw as ChartPoint).miss ? '  pause outlived the cache: full re-write'
                              : (it.raw as ChartPoint).paused ? '  pause within cache lifetime: cache kept' : '',
            labelColor: (it) => ({ borderColor: it.dataset.borderColor as string, backgroundColor: it.dataset.borderColor as string }),
          },
          boxHeight: 2, boxWidth: 12,
        },
      },
    },
    plugins: [crosshair, makeEndLabels(getFormat)],
  }
}

/** Applies the current CSS theme colours to the chart; call chart.update() afterwards. */
export function applyTheme(chart: LineChart): void {
  const ink2 = css('--ink-2')
  chart.data.datasets[0].borderColor = css('--series-a')
  chart.data.datasets[1].borderColor = css('--series-b')
  for (const axis of Object.values(chart.options.scales ?? {})) {
    if (!axis) continue
    axis.ticks = { ...axis.ticks, color: css('--muted') }
    axis.title = { ...axis.title, display: true, color: ink2 }
    axis.grid = { color: css('--grid') }
    axis.border = { color: css('--axis') }
  }
  const plugins = chart.options.plugins!
  plugins.legend = { ...plugins.legend, labels: { ...plugins.legend?.labels, color: ink2 } }
  plugins.tooltip = {
    ...plugins.tooltip, backgroundColor: css('--surface'), titleColor: ink2, bodyColor: css('--ink'),
    borderColor: css('--border'), borderWidth: 1,
  }
}

import {
  Chart, Interaction, Legend, LinearScale, LogarithmicScale, LineController, LineElement, PointElement, Tooltip,
  type ChartConfiguration, type ChartType, type InteractionItem, type InteractionModeFunction, type Plugin,
} from 'chart.js'
import { everyOtherTickLabel, fmtTokens, logTickLabel, truncateLabel } from '../format'
import type { Point, Run, SetupId } from '../model/types'
import { css } from '../theme'

Chart.register(LineController, LineElement, PointElement, LinearScale, LogarithmicScale, Tooltip, Legend)
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
/** `y` is null for a value a log axis cannot show (zero or less), which Chart.js then skips. */
export type ChartPoint = Point & { y: number | null }

/** The y axis of a chart: linear, or logarithmic (the per-request chart's default). */
export type YScale = 'linear' | 'log'
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

// Direct labels at each line's end ("Fast cache $55.93"); nudged apart when they would overlap.
// The formatter is closed over, not passed as a plugin option: Chart.js would treat a function option as
// scriptable and call it with its own context.
const END_LABEL_NAME_MAX = 14
const END_LABEL_FONT = '600 12px system-ui, -apple-system, sans-serif'
const endLabelText = (ds: { label?: string; data: ChartPoint[] }, format: (usd: number) => string) =>
  `${truncateLabel(ds.label ?? '', END_LABEL_NAME_MAX)} ${format(ds.data.at(-1)?.y ?? 0)}`

const makeEndLabels = (getFormat: () => (usd: number) => string): Plugin<'line', { enabled: boolean }> => ({
  id: 'endLabels',
  // The names are user text of any width: reserve exactly the room the widest label needs (8px gap, 4px slack).
  beforeLayout(chart, _args, opts) {
    if (!opts.enabled) return
    const { ctx } = chart
    const format = getFormat()
    ctx.save()
    ctx.font = END_LABEL_FONT
    const widest = Math.max(0, ...(chart as LineChart).data.datasets.map((ds) => ctx.measureText(endLabelText(ds, format)).width))
    ctx.restore()
    chart.options.layout = { ...chart.options.layout, padding: { right: Math.ceil(widest) + 12 } }
  },
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts.enabled) return
    const format = getFormat()
    const { ctx, chartArea } = chart
    const labels = (chart as LineChart).data.datasets.map((ds, i) => {
      const last = chart.getDatasetMeta(i).data.at(-1)
      return last && { x: last.x, y: Math.max(last.y, chartArea.top + 6), text: endLabelText(ds, format) }
    }).filter((l) => !!l).sort((a, b) => a.y - b.y)
    labels.forEach((l, i) => { if (i && l.y - labels[i - 1].y < 14) l.y = labels[i - 1].y + 14 })
    ctx.save()
    ctx.font = END_LABEL_FONT
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

/**
 * The default legend items, with each key styled from its dataset line. With `usePointStyle`, Chart.js takes a key's stroke
 * from the dataset's *point* options (here the surface-coloured ring, which is invisible) and never passes the dash on, so
 * the line key would be blank. The key is drawn by Chart.js itself ('line' point style, `pointStyleWidth` wide), so it stays
 * crisp at any devicePixelRatio and follows the theme: the colour is read from the dataset on every update.
 */
export function legendLabels(chart: Chart) {
  return Chart.defaults.plugins.legend.labels.generateLabels(chart).map((item) => {
    const ds = item.datasetIndex === undefined ? undefined : (chart.data.datasets[item.datasetIndex] as { borderColor?: unknown; borderDash?: number[]; borderWidth?: number } | undefined)
    if (!ds) return item
    return { ...item, strokeStyle: ds.borderColor as string, lineDash: ds.borderDash ?? [], lineWidth: ds.borderWidth ?? 2 }
  })
}

/** One line of a chart: which setup, its colour variable and dash, and its simulated run. */
export interface ChartSeries {
  id: SetupId
  /** The display name: the legend, tooltip and end label text. */
  name: string
  cssVar: string
  dash: readonly number[]
  run: Run
}

/** A dataset for one setup. Points, colour and dash are filled in by the chart component on every update. */
export function makeDataset(id: SetupId) {
  return {
    label: `Setup ${id}`, data: [] as ChartPoint[], borderWidth: 2, tension: 0,
    pointRadius: (c: { raw: unknown }) => (raw(c)?.miss ? 4 : 0),
    // Every marker is a cache re-write: filled with the series colour, ringed with the surface colour.
    pointBackgroundColor: (c: { dataset: { borderColor?: unknown } }) => c.dataset.borderColor as string,
    pointBorderColor: () => css('--surface'),
    pointBorderWidth: 2, pointHoverRadius: 4, pointHitRadius: 12,
  }
}

/** `getFormat` formats a plotted (display-currency) value; it is read at draw time, so the currency can change without rebuilding the chart. */
export function lineConfig(showEndLabels: boolean, getFormat: () => (usd: number) => string): ChartConfiguration<'line', ChartPoint[]> {
  return {
    type: 'line',
    data: { datasets: [] },
    options: {
      animation: false, responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'nearestPerDataset', intersect: false },
      layout: { padding: { right: showEndLabels ? 72 : 0 } },
      scales: {
        x: { type: 'linear', min: 0, ticks: { callback: (v) => fmtTokens(Number(v)), maxTicksLimit: 11 },
             title: { display: true, text: 'Context size (tokens)' } },
        y: {
          beginAtZero: true,
          // The scale type can change after creation, so the rule follows it: `this` is the scale.
          ticks: { callback(v, i) { return this.type === 'logarithmic' ? logTickLabel(Number(v), getFormat()) : everyOtherTickLabel(Number(v), i, getFormat()) } },
          title: { display: true, text: 'USD' },
        },
      },
      plugins: {
        endLabels: { enabled: showEndLabels },
        legend: { align: 'start', labels: { usePointStyle: true, pointStyle: 'line', pointStyleWidth: 16, boxWidth: 16, generateLabels: legendLabels } },
        tooltip: {
          callbacks: {
            title: (items) => `${fmtTokens(items[0].parsed.x as number)} tokens in context`,
            label: (it) => `${getFormat()(it.parsed.y as number)}  ${it.dataset.label}`,
            afterLabel: (it) => ((it.raw as ChartPoint).miss ? '  cache expired: full re-write' : ''),
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

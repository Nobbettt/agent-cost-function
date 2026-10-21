import { Chart } from 'chart.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { legendLabels, lineConfig } from './chartConfig'

// Regression: with usePointStyle Chart.js takes a legend key's stroke from the dataset's point options, which are the
// surface-coloured ring, so every key was drawn in the background colour (invisible) and without the dash.
const SURFACE = '#ffffff'
const datasets = [
  { borderColor: '#2a78d6', borderDash: [], borderWidth: 2 },
  { borderColor: '#e87ba4', borderDash: [6, 3], borderWidth: 2 },
  { borderColor: '#eda100', borderDash: [2, 3], borderWidth: 2 },
]
// What Chart.js hands over: the point ring colour as the stroke, no dash.
const chartJsItems = datasets.map((_, datasetIndex) => ({ text: `Setup ${datasetIndex}`, strokeStyle: SURFACE, lineDash: undefined, lineWidth: 2, pointStyle: 'line', datasetIndex }))

describe('legend keys', () => {
  afterEach(() => vi.restoreAllMocks())

  it('are stroked with the series colour and dash, not the point ring colour', () => {
    vi.spyOn(Chart.defaults.plugins.legend.labels, 'generateLabels').mockReturnValue(chartJsItems as never)
    const items = legendLabels({ data: { datasets } } as unknown as Chart)
    expect(items.map((i) => i.strokeStyle)).toEqual(['#2a78d6', '#e87ba4', '#eda100'])
    expect(items.map((i) => i.lineDash)).toEqual([[], [6, 3], [2, 3]])
    expect(items.every((i) => i.strokeStyle !== SURFACE && i.lineWidth === 2)).toBe(true)
  })

  it('leave an item alone when its dataset is gone', () => {
    vi.spyOn(Chart.defaults.plugins.legend.labels, 'generateLabels').mockReturnValue(chartJsItems as never)
    expect(legendLabels({ data: { datasets: [] } } as unknown as Chart)[0].strokeStyle).toBe(SURFACE)
  })

  it('are drawn by Chart.js as 16px line keys, so they are crisp at any pixel ratio', () => {
    const labels = lineConfig(false, () => String).options!.plugins!.legend!.labels!
    expect(labels).toMatchObject({ usePointStyle: true, pointStyle: 'line', pointStyleWidth: 16, boxWidth: 16, generateLabels: legendLabels })
  })
})

import type { GridCell } from './breakEven'

/** Which pole a cell sits at: the 5 minute cache cheaper (blue), the 1 hour cache cheaper (red), or about equal (grey). */
export type Side = '5m' | '1h' | 'even'

export interface SavingStep {
  side: Side
  /** 0 for "about equal"; otherwise 1 to 4, the quarter of the strongest saving on the map. */
  step: 0 | 1 | 2 | 3 | 4
}

/** The saving (cost5 - cost1h) is "about equal" below this share of the cheaper cost. */
export const EVEN_SHARE = 0.01
export const STEPS = 4

/**
 * Colour bucket of a cell for a diverging scale: the sign picks the pole, `|saving| / maxAbs` picks one of four steps
 * (a quarter each, the strongest saving on the map being step 4), and a saving under 1% of the cheaper cost is neutral.
 */
export function savingStep(saving: number, cheaperCost: number, maxAbs: number): SavingStep {
  if (Math.abs(saving) < EVEN_SHARE * cheaperCost || maxAbs <= 0) return { side: 'even', step: 0 }
  const step = Math.min(STEPS, Math.max(1, Math.ceil((Math.abs(saving) / maxAbs) * STEPS))) as 1 | 2 | 3 | 4
  return { side: saving > 0 ? '1h' : '5m', step }
}

/** The bucket of every cell of a grid (the strongest saving anywhere on the grid is the scale's end). */
export function bucketGrid(grid: readonly GridCell[]): Map<GridCell, SavingStep> {
  const maxAbs = Math.max(0, ...grid.map((c) => Math.abs(c.saving)))
  return new Map(grid.map((c) => [c, savingStep(c.saving, Math.min(c.cost5, c.cost1h), maxAbs)]))
}

/** The CSS colour of a bucket: the pole mixed into the neutral grey in that many quarters. */
export const stepColor = ({ side, step }: SavingStep): string =>
  side === 'even' ? 'var(--pole-neutral)' : `color-mix(in oklab, var(${side === '1h' ? '--pole-red' : '--pole-blue'}) ${step * 25}%, var(--pole-neutral))`

/** The words for a cell, used by the tooltip and the cell's aria-label: who is cheaper and by how much, in the display currency. */
export function cellLines(cell: GridCell, format: (usd: number) => string): string[] {
  const money = (usd: number) => format(Math.abs(usd))
  return [
    `5–60 min: ${cell.short} · over 60 min: ${cell.long}`,
    `5 min cache ${money(cell.cost5)}`,
    `1 hour cache ${money(cell.cost1h)}`,
    cell.saving >= 0 ? `1 hour cache saves ${money(cell.saving)}` : `1 hour cache costs ${money(cell.saving)} more`,
  ]
}

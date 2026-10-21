import type { SetupId } from '../model/types'

export const SETUP_IDS: readonly SetupId[] = ['A', 'B', 'C', 'D']
export const MIN_SETUPS = 2
export const MAX_SETUPS = SETUP_IDS.length

/**
 * Series identity per setup: CSS colour variable and line dash. A and B are solid; C and D are dashed
 * as a secondary encoding next to the colour (magenta and yellow are weak on the light surface).
 */
export const SERIES: Readonly<Record<SetupId, { cssVar: string; dash: readonly number[] }>> = {
  A: { cssVar: '--series-a', dash: [] },
  B: { cssVar: '--series-b', dash: [] },
  C: { cssVar: '--series-c', dash: [6, 3] },
  D: { cssVar: '--series-d', dash: [2, 3] },
}

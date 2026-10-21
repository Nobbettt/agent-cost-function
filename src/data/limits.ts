/** Input ranges, shared by the number fields and by the share-link parser so both clamp the same way. */
export const INTERRUPTION_LIMITS = { min: 0, max: 50 } as const

export const SHARED_LIMITS = {
  session: { min: 10000, max: 1000000, step: 10000 },
  base: { min: 0, max: 200000, step: 1000 },
  growth: { min: 500, max: 200000, step: 500 },
  visibleOut: { min: 0, max: 64000, step: 100 },
  thinking: { min: 0, max: 128000, step: 100 },
} as const

import { useCallback, useState } from 'react'
import type { YScale } from '../components/chartConfig'

/** A view preference of this viewer, never part of a share link. */
export const REQ_SCALE_STORAGE_KEY = 'acf.reqScale'

function read(): YScale {
  try {
    if (localStorage.getItem(REQ_SCALE_STORAGE_KEY) === 'linear') return 'linear'
  } catch {
    // Storage blocked or unavailable: the default applies.
  }
  return 'log' // also for a missing or invalid stored value
}

/** The per-request chart's y scale: log by default, the choice remembered in localStorage. */
export function useReqScale(): [YScale, (next: YScale) => void] {
  const [scale, setScale] = useState<YScale>(read)
  const set = useCallback((next: YScale) => {
    setScale(next)
    try {
      localStorage.setItem(REQ_SCALE_STORAGE_KEY, next)
    } catch {
      // Storage blocked or full: the choice is simply not remembered.
    }
  }, [])
  return [scale, set]
}

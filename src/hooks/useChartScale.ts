import { useCallback, useState } from 'react'
import type { YScale } from '../components/chartConfig'

/** Where each chart's y scale is remembered: a view preference of this viewer, never part of a share link. */
export const REQ_SCALE_STORAGE_KEY = 'acf.reqScale'
export const CUM_SCALE_STORAGE_KEY = 'acf.cumScale'

function read(key: string, fallback: YScale): YScale {
  try {
    const stored = localStorage.getItem(key)
    if (stored === 'linear' || stored === 'log') return stored
  } catch {
    // Storage blocked or unavailable: the default applies.
  }
  return fallback // also for a missing or invalid stored value
}

/** One chart's y scale, remembered in localStorage under its own key; `fallback` applies until the viewer chooses. */
export function useChartScale(storageKey: string, fallback: YScale): [YScale, (next: YScale) => void] {
  const [scale, setScale] = useState<YScale>(() => read(storageKey, fallback))
  const set = useCallback((next: YScale) => {
    setScale(next)
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      // Storage blocked or full: the choice is simply not remembered.
    }
  }, [storageKey])
  return [scale, set]
}

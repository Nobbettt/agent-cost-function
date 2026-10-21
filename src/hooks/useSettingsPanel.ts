import { useCallback, useState } from 'react'
import { useMediaQuery } from './useMediaQuery'

/** At and above this width the settings are a docked sidebar; below it, an off-canvas drawer. */
export const DOCKED_QUERY = '(min-width: 1024px)'

export const STORAGE_KEYS = { docked: 'acf.settings.docked', drawer: 'acf.settings.drawer' } as const
const DEFAULT_OPEN = { docked: true, drawer: false } as const

export type SettingsMode = 'docked' | 'drawer'
type OpenByMode = Record<SettingsMode, boolean>

function readStored(mode: SettingsMode): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEYS[mode])
    if (v === 'true') return true
    if (v === 'false') return false
  } catch {
    // Storage blocked or unavailable: fall through to the default.
  }
  return DEFAULT_OPEN[mode]
}

function writeStored(mode: SettingsMode, open: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS[mode], String(open))
  } catch {
    // Storage blocked or full: the choice is simply not remembered.
  }
}

/**
 * Open state of the settings panel, remembered per mode (docked / drawer) in localStorage.
 * When the viewport crosses the breakpoint the mode's own remembered or default value applies.
 */
export function useSettingsPanel() {
  const mode: SettingsMode = useMediaQuery(DOCKED_QUERY, true) ? 'docked' : 'drawer'
  const [byMode, setByMode] = useState<OpenByMode>(() => ({ docked: readStored('docked'), drawer: readStored('drawer') }))
  const open = byMode[mode]

  const set = useCallback(
    (next: boolean) => {
      setByMode((prev) => ({ ...prev, [mode]: next }))
      writeStored(mode, next)
    },
    [mode],
  )
  const toggle = useCallback(() => set(!open), [set, open])
  const close = useCallback(() => set(false), [set])

  return { open, toggle, close, mode }
}

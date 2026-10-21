import { useCallback, useState } from 'react'
import { useMediaQuery } from './useMediaQuery'

/** At and above this width the settings are a docked sidebar; below it, an off-canvas drawer. */
export const DOCKED_QUERY = '(min-width: 1024px)'

/** Only the docked sidebar's state is remembered; the drawer always starts closed. */
export const DOCKED_STORAGE_KEY = 'acf.settings.docked'

export type SettingsMode = 'docked' | 'drawer'

function readDocked(): boolean {
  try {
    const v = localStorage.getItem(DOCKED_STORAGE_KEY)
    if (v === 'true') return true
    if (v === 'false') return false
  } catch {
    // Storage blocked or unavailable: fall through to the default (open).
  }
  return true
}

function writeDocked(open: boolean): void {
  try {
    localStorage.setItem(DOCKED_STORAGE_KEY, String(open))
  } catch {
    // Storage blocked or full: the choice is simply not remembered.
  }
}

/**
 * Open state of the settings panel. Docked (large screens): open by default, the viewer's choice
 * is remembered in localStorage. Drawer (small screens): always closed on load and whenever the
 * viewport flips into drawer mode; never stored.
 */
export function useSettingsPanel() {
  const mode: SettingsMode = useMediaQuery(DOCKED_QUERY, true) ? 'docked' : 'drawer'
  const [dockedOpen, setDockedOpen] = useState(readDocked)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [seenMode, setSeenMode] = useState(mode)

  // Entering (or leaving) drawer mode resets the drawer to closed. Adjusting state during render
  // avoids a frame with a stale open drawer.
  if (seenMode !== mode) {
    setSeenMode(mode)
    setDrawerOpen(false)
  }

  const open = mode === 'docked' ? dockedOpen : drawerOpen

  const set = useCallback(
    (next: boolean) => {
      if (mode === 'docked') {
        setDockedOpen(next)
        writeDocked(next)
      } else {
        setDrawerOpen(next)
      }
    },
    [mode],
  )
  const toggle = useCallback(() => set(!open), [set, open])
  const close = useCallback(() => set(false), [set])

  return { open, toggle, close, mode }
}

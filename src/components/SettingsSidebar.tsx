import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import type { SettingsMode } from '../hooks/useSettingsPanel'

interface Props {
  open: boolean
  mode: SettingsMode
  onClose: () => void
  /** The button that toggles the panel; gets focus back when the drawer closes. */
  returnFocusRef: RefObject<HTMLElement | null>
  children: ReactNode
}

const FOCUSABLE = 'summary, input:not([disabled]), select:not([disabled]), button:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/**
 * The settings panel: a docked sidebar on large screens, an off-canvas drawer below.
 * Closed, it is `inert` (out of the tab order and the accessibility tree).
 * Drawer behaviour: focus moves in on open and back to the toggle on close, Esc and the backdrop close it.
 */
export function SettingsSidebar({ open, mode, onClose, returnFocusRef, children }: Props) {
  const panel = useRef<HTMLElement>(null)
  const previous = useRef({ open, mode })
  const drawerOpen = mode === 'drawer' && open

  // Move focus only for a user-driven change inside the drawer, never on mount or when the breakpoint flips.
  useEffect(() => {
    const before = previous.current
    previous.current = { open, mode }
    if (mode !== 'drawer' || before.mode !== mode || before.open === open) return
    // Skip the "?" tip buttons: focusing one would pop its tooltip open.
    if (open) Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).find((el) => !el.classList.contains('info-btn'))?.focus()
    else returnFocusRef.current?.focus()
  }, [open, mode, returnFocusRef])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen, onClose])

  return (
    <>
      {drawerOpen && <div className="backdrop" data-testid="settings-backdrop" aria-hidden="true" onClick={onClose} />}
      <aside id="settings-panel" className="controls" aria-label="Settings" ref={panel} inert={!open}>
        {children}
      </aside>
    </>
  )
}

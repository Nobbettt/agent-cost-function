import { useEffect, useRef, type ReactNode } from 'react'
import type { SettingsMode } from '../hooks/useSettingsPanel'

interface Props {
  open: boolean
  mode: SettingsMode
  /** The one toggle: the header arrow and the rail both call it. */
  onToggle: () => void
  onClose: () => void
  children: ReactNode
}

const FOCUSABLE = 'input:not([disabled]), select:not([disabled]), button:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

function DoubleChevron({ direction }: { direction: 'left' | 'right' }) {
  const d = direction === 'right' ? 'M3 3l4 4-4 4M8 3l4 4-4 4' : 'M11 3L7 7l4 4M6 3L2 7l4 4'
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

/**
 * The settings panel. Expanded it has a title row with a "Hide settings" arrow over the body; collapsed it is a
 * slim rail that is one "Show settings" button. Docked (large screens) it is a column of the page; in drawer mode
 * the expanded panel slides in over the content, with a backdrop, and Esc or a backdrop click close it.
 * Only the header button or the rail button is rendered at a time; the body is hidden while collapsed.
 */
export function SettingsSidebar({ open, mode, onToggle, onClose, children }: Props) {
  const body = useRef<HTMLDivElement>(null)
  const hideButton = useRef<HTMLButtonElement>(null)
  const rail = useRef<HTMLButtonElement>(null)
  const previous = useRef({ open, mode })
  const drawerOpen = mode === 'drawer' && open

  // Move focus only for a user-driven change, never on mount or when the breakpoint flips:
  // expanding focuses the header button (the first accordion header in the drawer); collapsing focuses the rail.
  useEffect(() => {
    const before = previous.current
    previous.current = { open, mode }
    if (before.mode !== mode || before.open === open) return
    if (!open) {
      rail.current?.focus()
    } else if (mode === 'docked') {
      hideButton.current?.focus()
    } else {
      // Skip the "?" tip buttons (focusing one would pop its tooltip open) and the currency field.
      Array.from(body.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
        .find((el) => !el.classList.contains('info-btn') && !el.closest('.currency-field'))
        ?.focus()
    }
  }, [open, mode])

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
      <aside id="settings-panel" className="controls" aria-label="Settings" data-state={open ? 'expanded' : 'collapsed'}>
        {open ? (
          <div className="settings-head">
            <h2>Settings</h2>
            <button
              ref={hideButton} type="button" className="settings-hide"
              aria-label="Hide settings" aria-expanded="true" aria-controls="settings-content" onClick={onToggle}
            >
              <DoubleChevron direction="right" />
            </button>
          </div>
        ) : (
          <button
            ref={rail} type="button" className="settings-rail"
            aria-label="Show settings" aria-expanded="false" aria-controls="settings-content" onClick={onToggle}
          >
            <DoubleChevron direction="left" />
            <span className="settings-rail-label" aria-hidden="true">Settings</span>
          </button>
        )}
        <div className="settings-body" id="settings-content" ref={body} hidden={!open}>
          {children}
        </div>
      </aside>
    </>
  )
}

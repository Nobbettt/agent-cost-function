import type { ReactNode, RefObject } from 'react'
import type { Page } from './siteLinks'

interface SettingsToggle {
  open: boolean
  onToggle: () => void
}

interface Props {
  page: Page
  /** Calculator page only: the button that opens and closes the settings panel. */
  settings?: SettingsToggle
  /** Ref for the Settings button, so the drawer can return focus to it. */
  settingsButtonRef?: RefObject<HTMLButtonElement | null>
  /** Calculator page only: extra controls (the currency select) placed left of the Settings button. */
  controls?: ReactNode
}


function SlidersIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 4h6.5M11.5 4H14M2 8h2.5M7.5 8H14M2 12h7M12.5 12H14" />
      <circle cx="10" cy="4" r="1.5" />
      <circle cx="6" cy="8" r="1.5" />
      <circle cx="11" cy="12" r="1.5" />
    </svg>
  )
}

export function NavBar({ page, settings, settingsButtonRef, controls }: Props) {
  return (
    <header className="navbar">
      <nav aria-label="Main">
        <a href="/" className="brand">
          <span className="brand-full">Agent Cost Function</span>
          <span className="brand-short" aria-hidden="true">ACF</span>
        </a>
        <div className="nav-links">
          {/* The one page link: the calculator itself. The footer links the other pages. */}
          {page === 'calculator' ? <span aria-current="page">Explore</span> : <a href="/">Explore</a>}
        </div>
        {(controls || settings) && (
          <div className="nav-end">
            {controls}
            {settings && (
              <button
                type="button" className="settings-toggle" ref={settingsButtonRef}
                aria-expanded={settings.open} aria-controls="settings-panel" onClick={settings.onToggle}
              >
                <SlidersIcon />
                Settings
              </button>
            )}
          </div>
        )}
      </nav>
    </header>
  )
}

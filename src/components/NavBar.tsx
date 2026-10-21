import type { ReactNode } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import type { Page } from './siteLinks'

interface Props {
  page: Page
  /** Calculator page only: controls on the right (Share, and the currency select from the compact breakpoint up). */
  controls?: ReactNode
}

export function NavBar({ page, controls }: Props) {
  // One text at a time (not two spans), so the accessible name is always the visible text.
  const longName = useMediaQuery('(min-width: 640px)', true)
  return (
    <header className="navbar">
      <nav aria-label="Main">
        <a href="/" className="brand">
          <span className="brand-full">Agent Cost Function</span>
          <span className="brand-short" aria-hidden="true">ACF</span>
        </a>
        <div className="nav-links">
          {/* Always real links to the two tools; the one for the current page carries aria-current. */}
          <a href="/" aria-current={page === 'calculator' ? 'page' : undefined}>Explore</a>
          <a href="/cache-break-even/" aria-current={page === 'cache-break-even' ? 'page' : undefined}>
            {longName ? 'Claude Cache Break-even' : 'Cache break-even'}
          </a>
        </div>
        {controls && <div className="nav-end">{controls}</div>}
      </nav>
    </header>
  )
}

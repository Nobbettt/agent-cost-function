import type { ReactNode } from 'react'
import type { Page } from './siteLinks'

interface Props {
  page: Page
  /** Calculator page only: controls on the right (Share, and the currency select from the compact breakpoint up). */
  controls?: ReactNode
}

export function NavBar({ page, controls }: Props) {
  return (
    <header className="navbar">
      <nav aria-label="Main">
        <a href="/" className="brand">
          <span className="brand-full">Agent Cost Function</span>
          <span className="brand-short" aria-hidden="true">ACF</span>
        </a>
        <div className="nav-links">
          {/* The one page link: the calculator itself, always a real link; current (aria-current) on the calculator. */}
          <a href="/" aria-current={page === 'calculator' ? 'page' : undefined}>Explore</a>
        </div>
        {controls && <div className="nav-end">{controls}</div>}
      </nav>
    </header>
  )
}

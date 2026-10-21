import { Fragment } from 'react'
import { PRICES_CHECKED } from '../data/pricing'
import { SITE_LINKS, type Page } from './siteLinks'

/**
 * Site nav shared by all pages. Same-site links: absolute paths (vite `base` is '/'), same tab.
 * The current page is plain text; the calculator has no entry of its own on its page.
 */
export function Footer({ page }: { page: Page }) {
  const entries = SITE_LINKS.filter((l) => l.page !== 'calculator' || page !== 'calculator')
  return (
    <footer className={page === 'calculator' ? 'wide' : undefined}>
      <div>
        Prices and settings checked {PRICES_CHECKED} ·{' '}
        <nav aria-label="Site">
          {entries.map((l, i) => (
            <Fragment key={l.page}>
              {i > 0 && ' · '}
              {l.page === page ? <span aria-current="page">{l.label}</span> : <a href={l.href}>{l.label}</a>}
            </Fragment>
          ))}
        </nav>
      </div>
    </footer>
  )
}

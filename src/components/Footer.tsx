import { Fragment } from 'react'
import { PRICES_CHECKED } from '../data/pricing'

type Page = 'calculator' | 'how-it-works' | 'sources'

const LINKS: { page: Page; href: string; label: string }[] = [
  { page: 'calculator', href: '/', label: 'Calculator' },
  { page: 'how-it-works', href: '/how-it-works/', label: 'How it is calculated' },
  { page: 'sources', href: '/sources/', label: 'Sources' },
]

/**
 * Site nav shared by all pages. Same-site links: absolute paths (vite `base` is '/'), same tab.
 * The current page is plain text; the calculator has no entry of its own on its page.
 */
export function Footer({ page }: { page: Page }) {
  const entries = LINKS.filter((l) => l.page !== 'calculator' || page !== 'calculator')
  return (
    <footer>
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

import { PRICES_CHECKED } from '../data/pricing'

/** Same-site links: absolute paths (vite `base` is '/'), same tab. */
export function Footer({ page }: { page: 'calculator' | 'sources' }) {
  return (
    <footer>
      {page === 'calculator' ? (
        <p>Prices and settings checked {PRICES_CHECKED} · <a href="/sources/">Sources</a></p>
      ) : (
        <p><a href="/">Back to the calculator</a></p>
      )}
    </footer>
  )
}

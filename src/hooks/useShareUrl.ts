import { useEffect } from 'react'

/** The page's own address for a query string: origin and path as they are, plus the query when there is one. */
export const buildShareUrl = (query: string, loc: Pick<Location, 'origin' | 'pathname'> = window.location): string =>
  `${loc.origin}${loc.pathname}${query ? `?${query}` : ''}`

/**
 * Keeps the address bar equal to the current shareable link: after `delayMs` without a change it swaps the
 * query with history.replaceState (no new history entry). A clean state leaves a clean "/".
 */
export function useShareUrlSync(query: string, delayMs = 250): void {
  useEffect(() => {
    const timer = setTimeout(() => {
      const { pathname, search, hash } = window.location
      const next = `${pathname}${query ? `?${query}` : ''}${hash}`
      if (next !== `${pathname}${search}${hash}`) window.history.replaceState(window.history.state, '', next)
    }, delayMs)
    return () => clearTimeout(timer)
  }, [query, delayMs])
}

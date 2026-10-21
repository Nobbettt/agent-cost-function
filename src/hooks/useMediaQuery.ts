import { useSyncExternalStore } from 'react'

/** Live `matchMedia(query).matches`; `fallback` where matchMedia does not exist (and on the server). */
export function useMediaQuery(query: string, fallback: boolean): boolean {
  const mql = () => (typeof window.matchMedia === 'function' ? window.matchMedia(query) : null)
  return useSyncExternalStore(
    (onChange) => {
      const m = mql()
      m?.addEventListener('change', onChange)
      return () => m?.removeEventListener('change', onChange)
    },
    () => mql()?.matches ?? fallback,
    () => fallback,
  )
}

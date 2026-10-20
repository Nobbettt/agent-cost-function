import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-color-scheme: dark)'

/** Current value of a CSS custom property on the root element (reads the live theme). */
export const css = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const mql = () => (typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null)

function subscribe(onChange: () => void) {
  const m = mql()
  m?.addEventListener('change', onChange)
  return () => m?.removeEventListener('change', onChange)
}

/** 'dark' or 'light' from prefers-color-scheme; re-renders the component when it changes. */
export function useColorScheme(): 'dark' | 'light' {
  return useSyncExternalStore(
    subscribe,
    () => (mql()?.matches ? 'dark' : 'light'),
    () => 'light',
  )
}

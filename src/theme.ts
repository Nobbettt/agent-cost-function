import { useMediaQuery } from './hooks/useMediaQuery'

/** Current value of a CSS custom property on the root element (reads the live theme). */
export const css = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/** 'dark' or 'light' from prefers-color-scheme; re-renders the component when it changes. */
export function useColorScheme(): 'dark' | 'light' {
  return useMediaQuery('(prefers-color-scheme: dark)', false) ? 'dark' : 'light'
}

import { vi } from 'vitest'

/** Stubs window.matchMedia with one shared query result that tests can flip. Undone by vi.unstubAllGlobals. */
export function mockMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()
  const list = {
    get matches() {
      return matches
    },
    addEventListener: (_type: string, l: () => void) => listeners.add(l),
    removeEventListener: (_type: string, l: () => void) => listeners.delete(l),
  }
  vi.stubGlobal('matchMedia', () => list)
  return {
    set(next: boolean) {
      matches = next
      listeners.forEach((l) => l())
    },
  }
}

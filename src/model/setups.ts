import { MODELS } from '../data/pricing'
import { MAX_SETUPS, MIN_SETUPS, SETUP_IDS } from '../data/series'
import type { CacheId, Setup, SetupId } from './types'

/** Short cache names, shared by the setup summaries and the stat cards. */
export const CACHE_LABEL: Readonly<Record<CacheId, string>> = {
  '5m': '5 min', '1h': '1 hour', '30m': '30 min', '24h': '24h', in_memory: 'in_memory',
}

/** "Claude Opus 5.5 · 5 min cache": the model and its cache. */
export const modelAndCache = (s: Setup): string => `${MODELS[s.model].name} · ${CACHE_LABEL[s.cache]} cache`

/** One compact line with every selected value, for a collapsed setup. */
export function summarizeSetup(s: Setup): string {
  const breaks = s.interruptions === 0 ? 'no cache breaks' : `${s.interruptions} cache break${s.interruptions === 1 ? '' : 's'}`
  return `${modelAndCache(s)} · ${s.effort} · reasoning ${s.reasoning} · ${breaks}`
}

export const canAddSetup = (setups: readonly Setup[]): boolean => setups.length < MAX_SETUPS
export const canRemoveSetup = (setups: readonly Setup[]): boolean => setups.length > MIN_SETUPS

/** The first letter A to D not used by any setup, or null when all four are in use. */
export function firstFreeId(setups: readonly Setup[]): SetupId | null {
  return SETUP_IDS.find((id) => !setups.some((s) => s.id === id)) ?? null
}

/**
 * A new setup that copies the last one, with the first free id. The list stays in letter order, so
 * the new setup may sit between existing ones. Returns the same list when it is full.
 */
export function addSetup(setups: readonly Setup[]): Setup[] {
  const id = firstFreeId(setups)
  const last = setups.at(-1)
  if (id === null || !last) return [...setups]
  return [...setups, { ...last, id }].sort((a, b) => a.id.localeCompare(b.id))
}

/** The list without that setup; the others keep their ids (and so their colours). A no-op at the minimum. */
export function removeSetup(setups: readonly Setup[], id: SetupId): Setup[] {
  return canRemoveSetup(setups) ? setups.filter((s) => s.id !== id) : [...setups]
}

/** Where focus goes after a removal: the previous setup, or the next one when the first was removed. */
export function focusAfterRemove(before: readonly Setup[], id: SetupId): SetupId | null {
  const i = before.findIndex((s) => s.id === id)
  if (i < 0) return null
  return (before[i - 1] ?? before[i + 1])?.id ?? null
}

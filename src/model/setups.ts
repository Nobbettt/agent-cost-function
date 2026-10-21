import { MODELS } from '../data/pricing'
import { MAX_SETUPS, MIN_SETUPS, SETUP_IDS } from '../data/series'
import type { CacheId, Setup, SetupId } from './types'

/** Short cache names, shared by the setup summaries and the stat cards. */
export const CACHE_LABEL: Readonly<Record<CacheId, string>> = {
  '5m': '5 min', '1h': '1 hour', '30m': '30 min', '24h': '24h', in_memory: 'in_memory', auto: 'best-effort',
}

/** "Claude Opus 5.5 · 5 min cache": the model and its cache. */
export const modelAndCache = (s: Setup): string => `${MODELS[s.model].name} · ${CACHE_LABEL[s.cache]} cache`

/** "6 cache breaks", "1 cache break", "no cache breaks": the one wording of the interruption count. */
export const cacheBreaks = (s: Setup): string =>
  s.interruptions === 0 ? 'no cache breaks' : `${s.interruptions} cache break${s.interruptions === 1 ? '' : 's'}`

/** The setup card's sub-line: "Claude Opus 5.5 · 5 min cache · 6 cache breaks". */
export const cardSubline = (s: Setup): string => `${modelAndCache(s)} · ${cacheBreaks(s)}`

/** One compact line with every selected value, for a collapsed setup. */
export function summarizeSetup(s: Setup): string {
  return `${modelAndCache(s)} · ${s.effort} · reasoning ${s.reasoning} · ${cacheBreaks(s)}`
}

export const MAX_NAME_LENGTH = 40

/** What a setup is called everywhere: its custom name, or "Setup A". User text: render as text only, never as HTML. */
export const displayName = (s: Pick<Setup, 'id' | 'name'>): string => s.name?.trim() || `Setup ${s.id}`

/**
 * The one place a typed or linked name is validated: whitespace runs become one space, control characters and
 * lone surrogates are dropped, the result is trimmed and cut at 40 UTF-16 units without splitting a surrogate pair.
 * Empty, or equal to the default "Setup X", gives undefined, so the setup falls back to its default name.
 */
export function cleanName(raw: string | null | undefined, id: SetupId): string | undefined {
  if (!raw) return undefined
  let s = raw.replace(/\s+/g, ' ').replace(/[\p{Cc}\p{Cs}]/gu, '').trim()
  if (s.length > MAX_NAME_LENGTH) {
    s = s.slice(0, MAX_NAME_LENGTH)
    if (/[\uD800-\uDBFF]$/.test(s)) s = s.slice(0, -1)
    s = s.trimEnd()
  }
  return !s || s === `Setup ${id}` ? undefined : s
}

export const canAddSetup = (setups: readonly Setup[]): boolean => setups.length < MAX_SETUPS
export const canRemoveSetup = (setups: readonly Setup[]): boolean => setups.length > MIN_SETUPS

/** The first letter A to D not used by any setup, or null when all four are in use. */
export function firstFreeId(setups: readonly Setup[]): SetupId | null {
  return SETUP_IDS.find((id) => !setups.some((s) => s.id === id)) ?? null
}

/**
 * A new setup that copies the last one (but not its custom name), with the first free id. The list stays in letter order, so
 * the new setup may sit between existing ones. Returns the same list when it is full.
 */
export function addSetup(setups: readonly Setup[]): Setup[] {
  const id = firstFreeId(setups)
  const last = setups.at(-1)
  if (id === null || !last) return [...setups]
  return [...setups, { ...last, id, name: undefined }].sort((a, b) => a.id.localeCompare(b.id))
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

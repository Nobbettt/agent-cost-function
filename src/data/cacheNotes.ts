import type { CacheId } from '../model/types'

/** How each cache works, in the words shown under the cache field and the interruptions field. Cache ids are unique per provider. */
export interface CacheInfo {
  /** The cache field's label. */
  label: string
  /** The value shown when the model has only this one option (a read-only field). */
  fixedValue: string
  /** Under the cache field. */
  note: string
  /** Under "Cache breaking interruptions": what counts as a break for this cache. */
  breakNote: string
}

const UNPREDICTABLE = "Any pause after which the cache is gone; when isn't predictable."

export const CACHE_INFO: Readonly<Record<CacheId, CacheInfo>> = {
  '5m': { label: 'Cache lifetime', fixedValue: '5 min', note: 'You set the lifetime; each hit restarts it. Writes cost 1.25× input.', breakNote: 'Pauses longer than 5 min.' },
  '1h': { label: 'Cache lifetime', fixedValue: '1 hour', note: 'Survives pauses up to an hour. Writes cost 2× input.', breakNote: 'Pauses longer than 1 hour.' },
  '30m': { label: 'Cache lifetime', fixedValue: '30 min (fixed)', note: "Automatic. Kept at least 30 min after last use; can't be changed. Writes cost 1.25× input.", breakNote: 'Pauses longer than 30 min.' },
  '24h': { label: 'Cache retention', fixedValue: '24h', note: 'Automatic, best-effort: usually about 30 min, up to 24 h. No write fee.', breakNote: UNPREDICTABLE },
  in_memory: { label: 'Cache retention', fixedValue: 'in_memory', note: 'Automatic, best-effort: usually 5–10 min idle, up to 1 h. No write fee.', breakNote: UNPREDICTABLE },
  auto: { label: 'Cache', fixedValue: 'Automatic', note: 'Best-effort, no lifetime setting; entries can be evicted at any time. No write fee.', breakNote: UNPREDICTABLE },
  implicit: { label: 'Cache', fixedValue: 'Implicit (automatic)', note: 'Best-effort, no lifetime setting or guarantee. No write fee.', breakNote: UNPREDICTABLE },
}

/** Appended to the interruptions note while a Gemini explicit cache is on. */
export const EXPLICIT_BREAK_NOTE = ' Prompt + tools stay in the explicit cache.'
export const EXPLICIT_CHECKBOX_NOTE = 'Guaranteed cache for the fixed start of the prompt. Costs hourly storage.'
export const EXPLICIT_HOURS_NOTE = 'Cache lifetime (TTL) is set to this. Storage is billed for the whole time.'
export const EXPLICIT_UNAVAILABLE_NOTE = "Explicit caching isn't available for this model."

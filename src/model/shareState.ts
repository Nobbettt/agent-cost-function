import { DEFAULT_SETUP_LIST, DEFAULT_SETUPS, DEFAULT_SHARED } from '../data/defaults'
import { isCurrencyCode, type CurrencyCode } from '../data/fx'
import { EXPLICIT_HOURS_LIMITS, INTERRUPTION_LIMITS, SHARED_LIMITS } from '../data/limits'
import { ALL_EFFORTS, MODELS } from '../data/pricing'
import { SETUP_IDS } from '../data/series'
import { normalizeSetup } from './normalize'
import { cleanName, usesExplicitCache } from './setups'
import type { CacheId, Effort, ReasoningMode, Setup, SetupId, Shared } from './types'

/** Version of the link format. Always written (except for the all-default state, whose link is just "/"). */
export const SHARE_VERSION = 1

export interface ShareState {
  setups: readonly Setup[]
  shared: Shared
  currency: CurrencyCode
}

export interface DecodedState {
  setups: Setup[]
  shared: Shared
  /** A valid `cur`, or null when absent or invalid (the viewer's stored currency then applies). */
  currency: CurrencyCode | null
  /** The link carries a version this app does not know: everything else was ignored. */
  versionMismatch: boolean
  /** The link carried at least one param of ours, so the page should open on the first setup. */
  hadParams: boolean
}

const OWN_PARAMS = ['v', 'a', 'b', 'c', 'd', 'na', 'nb', 'nc', 'nd', 'adv', 'cur'] as const
const THINKING_ORDER = ALL_EFFORTS // none, low, medium, high, xhigh, max

const sameSetup = (a: Setup, b: Setup) =>
  a.id === b.id && a.model === b.model && a.cache === b.cache && a.effort === b.effort && a.reasoning === b.reasoning && a.interruptions === b.interruptions && a.name === b.name && a.explicitHours === b.explicitHours

function advValues(s: Shared): number[] {
  return [s.session, s.base, s.growth, s.visibleOut, ...THINKING_ORDER.map((e) => s.thinking[e])].map(Math.round)
}

const sameShared = (a: Shared, b: Shared) => advValues(a).every((v, i) => v === advValues(b)[i])

const isDefaultState = (s: ShareState) =>
  s.currency === 'USD' &&
  sameShared(s.shared, DEFAULT_SHARED) &&
  s.setups.length === DEFAULT_SETUP_LIST.length &&
  s.setups.every((setup, i) => sameSetup(setup, DEFAULT_SETUP_LIST[i]))

/**
 * The query string (no leading "?") for a state. Empty for the all-default state, so the default link is a
 * clean "/". Commas stay readable; setup values only ever come from known enums and integers, so that is safe,
 * and in a name a literal comma is just as valid as an escaped one.
 */
export function encodeState(state: ShareState): string {
  if (isDefaultState(state)) return ''
  const params = new URLSearchParams()
  params.set('v', String(SHARE_VERSION))
  for (const s of state.setups) {
    params.set(s.id.toLowerCase(), [s.model, s.cache, s.effort, s.reasoning, s.interruptions, ...(usesExplicitCache(s) ? [`x${s.explicitHours}`] : [])].join(','))
  }
  // Names are free text (commas, "&", emoji), so each gets its own param; URLSearchParams escapes them.
  for (const s of state.setups) {
    const name = cleanName(s.name, s.id)
    if (name) params.set(`n${s.id.toLowerCase()}`, name)
  }
  if (!sameShared(state.shared, DEFAULT_SHARED)) params.set('adv', advValues(state.shared).join(','))
  if (state.currency !== 'USD') params.set('cur', state.currency)
  return params.toString().replace(/%2C/gi, ',')
}

const INT = /^\d+$/
const clampInt = (text: string | undefined, min: number, max: number, fallback: number) =>
  text !== undefined && INT.test(text) ? Math.min(max, Math.max(min, Number(text))) : fallback

/** The optional `x<hours>` field (an explicit cache): a number clamped to the allowed range, null when absent or malformed. */
function decodeHours(text: string | undefined): number | null {
  const m = text === undefined ? null : /^x(\d+(?:\.\d+)?)$/.exec(text)
  if (!m) return null
  const hours = Math.round(Number(m[1]) * 100) / 100
  return Number.isFinite(hours) ? Math.min(EXPLICIT_HOURS_LIMITS.max, Math.max(EXPLICIT_HOURS_LIMITS.min, hours)) : null
}

/** One `a`–`d` value to a valid setup, or null when the model is unknown. */
function decodeSetup(id: SetupId, value: string): Setup | null {
  const [model, cache, effort, reasoning, interruptions, extra] = value.split(',')
  if (!model || !Object.hasOwn(MODELS, model)) return null
  const spec = MODELS[model]
  const explicitHours = decodeHours(extra)
  // Wrong cache, effort or reasoning for this model fall back exactly like a model switch in the UI.
  return normalizeSetup(
    {
      id,
      provider: spec.provider,
      model,
      cache: cache as CacheId,
      effort: effort as Effort,
      reasoning: reasoning as ReasoningMode,
      interruptions: clampInt(interruptions, INTERRUPTION_LIMITS.min, INTERRUPTION_LIMITS.max, DEFAULT_SETUPS.A.interruptions),
      ...(explicitHours === null ? {} : { explicitHours }),
    },
    spec,
  )
}

/** Exactly 10 integers (session, base, growth, visible output, then thinking none..max), clamped; null if malformed. */
function decodeAdv(value: string): Shared | null {
  const parts = value.split(',')
  if (parts.length !== 4 + THINKING_ORDER.length || !parts.every((p) => INT.test(p))) return null
  const [session, base, growth, visibleOut, ...thinking] = parts.map(Number)
  const clamp = (v: number, l: { min: number; max: number }) => Math.min(l.max, Math.max(l.min, v))
  const s = clamp(session, SHARED_LIMITS.session)
  return {
    session: s,
    base: Math.min(clamp(base, SHARED_LIMITS.base), s),
    growth: clamp(growth, SHARED_LIMITS.growth),
    visibleOut: clamp(visibleOut, SHARED_LIMITS.visibleOut),
    thinking: Object.fromEntries(THINKING_ORDER.map((e, i) => [e, clamp(thinking[i], SHARED_LIMITS.thinking)])) as Shared['thinking'],
  }
}

/** Pads to at least two setups (never more) with the default ones, first free ids in order, keeping letter order. */
function withAtLeastTwo(found: Setup[]): Setup[] {
  const list = [...found]
  for (const d of DEFAULT_SETUP_LIST) {
    if (list.length >= 2) break
    if (!list.some((s) => s.id === d.id)) list.push({ ...d })
  }
  return list.sort((x, y) => x.id.localeCompare(y.id))
}

/**
 * The state for a location.search string. A trust boundary: never throws, and always returns 2 to 4 valid
 * setups and sound shared numbers, whatever the input. Unknown params are ignored.
 */
export function decodeState(search: string): DecodedState {
  const params = new URLSearchParams(search)
  const hadParams = OWN_PARAMS.some((k) => params.has(k))
  const defaults: DecodedState = { setups: [...DEFAULT_SETUP_LIST], shared: DEFAULT_SHARED, currency: null, versionMismatch: false, hadParams }

  const version = params.get('v')
  if (version !== null && version !== String(SHARE_VERSION)) return { ...defaults, versionMismatch: true }

  const found = SETUP_IDS.flatMap((id) => {
    const value = params.get(id.toLowerCase())
    const setup = value === null ? null : decodeSetup(id, value)
    if (!setup) return []
    const name = cleanName(params.get(`n${id.toLowerCase()}`), id)
    return [name ? { ...setup, name } : setup]
  })
  const adv = params.get('adv')
  const cur = params.get('cur')
  return {
    // No setup params at all is the plain default state; setup params that all fail still leave the minimum of two.
    setups: SETUP_IDS.some((id) => params.has(id.toLowerCase())) ? withAtLeastTwo(found) : defaults.setups,
    shared: (adv !== null ? decodeAdv(adv) : null) ?? DEFAULT_SHARED,
    currency: isCurrencyCode(cur) ? cur : null,
    versionMismatch: false,
    hadParams,
  }
}


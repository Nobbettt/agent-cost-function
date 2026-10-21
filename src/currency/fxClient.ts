import {
  CURRENCY_STORAGE_KEY, FX_STORAGE_KEY, FX_TIMEOUT_MS, FX_TTL_MS, FX_URL, isCurrencyCode, isIsoDate,
  parseFxResponse, sanitizeRates, type CurrencyCode, type FxRates,
} from '../data/fx'

export const isFresh = (rates: FxRates, now = Date.now()): boolean => {
  const age = now - rates.fetchedAt
  return age >= 0 && age < FX_TTL_MS
}

/** The stored display currency; anything unknown or unreadable is USD. */
export function readStoredCurrency(): CurrencyCode {
  try {
    const v = localStorage.getItem(CURRENCY_STORAGE_KEY)
    if (isCurrencyCode(v)) return v
  } catch {
    // Storage blocked: default.
  }
  return 'USD'
}

export function writeStoredCurrency(code: CurrencyCode): void {
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, code)
  } catch {
    // Storage blocked or full: the choice is simply not remembered.
  }
}

/** The cached rates, re-validated on read; null when missing, corrupt or unreadable. */
export function readCachedRates(): FxRates | null {
  try {
    const raw = localStorage.getItem(FX_STORAGE_KEY)
    if (!raw) return null
    const v: unknown = JSON.parse(raw)
    if (typeof v !== 'object' || v === null) return null
    const { fetchedAt, date, rates } = v as Record<string, unknown>
    const clean = sanitizeRates(rates)
    if (typeof fetchedAt !== 'number' || !Number.isFinite(fetchedAt) || !isIsoDate(date) || !clean) return null
    return { fetchedAt, date, rates: clean }
  } catch {
    return null
  }
}

function writeCachedRates(rates: FxRates): void {
  try {
    localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(rates))
  } catch {
    // Storage blocked or full: rates are just fetched again next time.
  }
}

async function fetchFresh(): Promise<FxRates> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FX_TIMEOUT_MS)
  try {
    const res = await fetch(FX_URL, { signal: controller.signal })
    if (!res.ok) throw new Error(`Exchange-rate request failed: HTTP ${res.status}`)
    const parsed = parseFxResponse(await res.json())
    if (!parsed) throw new Error('Exchange-rate response was not valid')
    const fresh: FxRates = { fetchedAt: Date.now(), ...parsed }
    writeCachedRates(fresh)
    return fresh
  } finally {
    clearTimeout(timer)
  }
}

let inflight: Promise<FxRates> | null = null

export interface LoadedRates {
  data: FxRates
  /** True when a refresh failed and an expired cache entry is being used. */
  stale: boolean
}

/**
 * Rates for display: the cache when it is under 24h old (no request), otherwise a single shared fetch.
 * If the fetch fails, an expired cache entry is returned as stale; with no cache at all it rejects.
 */
export async function loadRates(): Promise<LoadedRates> {
  const cached = readCachedRates()
  if (cached && isFresh(cached)) return { data: cached, stale: false }
  inflight ??= fetchFresh().finally(() => {
    inflight = null
  })
  try {
    return { data: await inflight, stale: false }
  } catch (error) {
    if (cached) return { data: cached, stale: true }
    throw error
  }
}

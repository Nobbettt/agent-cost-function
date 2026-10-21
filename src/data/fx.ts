/** Frankfurter serves the ECB reference rates: no API key, CORS open, no quotas. The only network call in the app. */
export const FX_URL = 'https://api.frankfurter.dev/v1/latest?base=USD'

/** Display currencies, in menu order. USD is always available at rate 1. */
export const CURRENCIES = ['USD', 'EUR', 'SEK', 'GBP', 'NOK', 'DKK', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'INR'] as const
export type CurrencyCode = (typeof CURRENCIES)[number]

export const FX_TTL_MS = 24 * 60 * 60 * 1000
export const FX_TIMEOUT_MS = 8000

export const CURRENCY_STORAGE_KEY = 'acf.currency'
export const FX_STORAGE_KEY = 'acf.fx'

/** Units of each currency per 1 USD. USD itself is implicit. */
export type FxRateTable = Partial<Record<CurrencyCode, number>>

export interface FxRates {
  /** Epoch ms when the rates were fetched. */
  fetchedAt: number
  /** ECB reference date, YYYY-MM-DD. */
  date: string
  rates: FxRateTable
}

export const isCurrencyCode = (v: unknown): v is CurrencyCode =>
  typeof v === 'string' && (CURRENCIES as readonly string[]).includes(v)

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const isIsoDate = (v: unknown): v is string => typeof v === 'string' && DATE_RE.test(v)

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Validates a rates object (every value must be a finite, positive number) and keeps only the curated
 * codes other than USD. Null when invalid or when no curated code is present.
 */
export function sanitizeRates(rates: unknown): FxRateTable | null {
  if (!isRecord(rates)) return null
  if (!Object.values(rates).every((r) => typeof r === 'number' && Number.isFinite(r) && r > 0)) return null
  const kept: FxRateTable = {}
  for (const code of CURRENCIES) {
    const rate = rates[code]
    if (code !== 'USD' && typeof rate === 'number') kept[code] = rate
  }
  return Object.keys(kept).length > 0 ? kept : null
}

/** Validates a Frankfurter `latest` response: base USD, a YYYY-MM-DD date and sound rates. Null when invalid. */
export function parseFxResponse(json: unknown): { date: string; rates: FxRateTable } | null {
  if (!isRecord(json) || json.base !== 'USD' || !isIsoDate(json.date)) return null
  const rates = sanitizeRates(json.rates)
  return rates ? { date: json.date, rates } : null
}

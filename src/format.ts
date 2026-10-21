export const fmtTokens = (t: number): string =>
  t >= 1e6 ? `${+(t / 1e6).toFixed(2)}M` : t >= 1e3 ? `${Math.round(t / 1e3)}K` : `${t}`

interface Affixes {
  prefix: string
  suffix: string
  /** The currency's own number of decimals (2 for most, 0 for JPY). */
  digits: number
}

const affixCache = new Map<string, Affixes>()

/** Symbol placement and minor digits for a currency, taken from Intl with the fixed en-US locale. */
function affixesOf(currency: string): Affixes {
  const cached = affixCache.get(currency)
  if (cached) return cached
  let result: Affixes
  try {
    const nf = new Intl.NumberFormat('en-US', { style: 'currency', currency })
    const parts = nf.formatToParts(1)
    const numeric = (type: string) => type === 'integer' || type === 'fraction' || type === 'decimal' || type === 'group'
    const first = parts.findIndex((p) => numeric(p.type))
    const last = parts.findLastIndex((p) => numeric(p.type))
    result = {
      prefix: parts.slice(0, first).map((p) => p.value).join(''),
      suffix: parts.slice(last + 1).map((p) => p.value).join(''),
      digits: nf.resolvedOptions().maximumFractionDigits ?? 2,
    }
  } catch {
    // Not a currency code Intl knows: show the bare code.
    result = { prefix: `${currency} `, suffix: '', digits: 2 }
  }
  affixCache.set(currency, result)
  return result
}

/**
 * `usd` converted at `rate` (units of `currency` per USD) and formatted for display.
 * Digits come from toFixed / toPrecision (not Intl rounding) so USD output stays byte-identical to the
 * original: 0 is "0", at least 100 has no decimals, at least 1 has the currency's decimals (max 2),
 * below 1 keeps 2 significant digits. An invalid rate falls back to USD; a non-finite result is a dash.
 */
export function formatMoney(usd: number, currency = 'USD', rate = 1): string {
  const valid = Number.isFinite(rate) && rate > 0
  const code = valid ? currency : 'USD'
  const value = usd * (valid ? rate : 1)
  if (!Number.isFinite(value)) return '—'
  const { prefix, suffix, digits } = affixesOf(code)
  const abs = Math.abs(value)
  const body = abs === 0 ? '0' : abs >= 100 ? abs.toFixed(0) : abs >= 1 ? abs.toFixed(Math.min(2, digits)) : abs.toPrecision(2)
  return `${value < 0 ? '-' : ''}${prefix}${body}${suffix}`
}

export const fmtUsd = (v: number): string => formatMoney(v, 'USD', 1)

export const fmtPrice = (v: number): string => `$${+v.toFixed(4)}`

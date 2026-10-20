export const fmtTokens = (t: number): string =>
  t >= 1e6 ? `${+(t / 1e6).toFixed(2)}M` : t >= 1e3 ? `${Math.round(t / 1e3)}K` : `${t}`

export const fmtUsd = (v: number): string =>
  v === 0 ? '$0' : `$${v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toPrecision(2)}`

export const fmtPrice = (v: number): string => `$${+v.toFixed(4)}`

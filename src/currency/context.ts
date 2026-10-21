import { createContext, useContext } from 'react'
import type { CurrencyCode } from '../data/fx'

export type FxStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface CurrencyState {
  /** The currency the viewer picked. */
  currency: CurrencyCode
  /** The currency actually shown: USD while the picked one has no rate. */
  displayCurrency: CurrencyCode
  setCurrency: (code: CurrencyCode) => void
  /** Units of displayCurrency per USD (1 for USD). */
  rate: number
  /** ECB reference date of the rate in use; null for USD. */
  rateDate: string | null
  status: FxStatus
  /** A refresh failed and an expired cached rate is in use. */
  stale: boolean
  /** False for a code missing from the fetched rates (USD is always available). */
  isAvailable: (code: CurrencyCode) => boolean
  format: (usd: number) => string
}

export const CurrencyContext = createContext<CurrencyState | null>(null)

export function useCurrency(): CurrencyState {
  const state = useContext(CurrencyContext)
  if (!state) throw new Error('useCurrency must be used inside <CurrencyProvider>')
  return state
}

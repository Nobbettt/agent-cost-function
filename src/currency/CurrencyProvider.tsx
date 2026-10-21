import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isCurrencyCode, type CurrencyCode, type FxRates } from '../data/fx'
import { formatMoney } from '../format'
import { CurrencyContext, type CurrencyState, type FxStatus } from './context'
import { isFresh, loadRates, readCachedRates, readStoredCurrency, writeStoredCurrency } from './fxClient'

interface FxState {
  phase: 'loading' | 'done' | 'failed'
  data: FxRates | null
  stale: boolean
}

function initialFx(currency: CurrencyCode): FxState {
  const data = readCachedRates()
  const needsFetch = currency !== 'USD' && !(data && isFresh(data))
  return { phase: needsFetch ? 'loading' : 'done', data, stale: false }
}

/**
 * Display currency and exchange rate. USD (the default) never touches the network; rates are only
 * loaded once a non-USD currency is selected, whether picked now or restored from storage.
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(readStoredCurrency)
  const [fx, setFx] = useState<FxState>(() => initialFx(currency))

  useEffect(() => {
    if (currency === 'USD') return
    let cancelled = false
    loadRates().then(
      ({ data, stale }) => {
        if (!cancelled) setFx({ phase: 'done', data, stale })
      },
      () => {
        if (!cancelled) setFx((prev) => ({ phase: 'failed', data: prev.data, stale: prev.data !== null }))
      },
    )
    return () => {
      cancelled = true
    }
  }, [currency])

  const setCurrency = useCallback((code: CurrencyCode) => {
    if (!isCurrencyCode(code)) return
    setCurrencyState(code)
    writeStoredCurrency(code)
    // Picking a currency (re)loads rates unless a rate is already usable, so show the loading state from the start.
    if (code !== 'USD') setFx((prev) => (prev.phase === 'loading' ? prev : { ...prev, phase: 'loading' }))
  }, [])

  const value = useMemo<CurrencyState>(() => {
    const picked = currency === 'USD' ? 1 : fx.data?.rates[currency]
    const usable = picked !== undefined
    const displayCurrency: CurrencyCode = usable ? currency : 'USD'
    const rate = usable ? picked : 1
    const status: FxStatus = currency === 'USD' ? 'idle' : usable ? 'ready' : fx.phase === 'loading' ? 'loading' : 'error'
    return {
      currency,
      displayCurrency,
      setCurrency,
      rate,
      rateDate: displayCurrency === 'USD' ? null : (fx.data?.date ?? null),
      status,
      stale: usable && currency !== 'USD' && fx.stale,
      isAvailable: (code) => code === 'USD' || !fx.data || fx.data.rates[code] !== undefined,
      format: (usd) => formatMoney(usd, displayCurrency, rate),
    }
  }, [currency, fx, setCurrency])

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

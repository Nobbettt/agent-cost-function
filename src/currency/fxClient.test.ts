import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENCY_STORAGE_KEY, FX_STORAGE_KEY, FX_TIMEOUT_MS, FX_TTL_MS, FX_URL, type FxRates } from '../data/fx'
import { isFresh, loadRates, readCachedRates, readStoredCurrency, writeStoredCurrency } from './fxClient'

const body = { amount: 1, base: 'USD', date: '2026-10-21', rates: { EUR: 0.89, SEK: 9.8785 } }
const okResponse = (json: unknown = body) => ({ ok: true, status: 200, json: async () => json }) as Response
const cacheEntry = (ageMs: number, date = '2026-10-01'): FxRates => ({ fetchedAt: Date.now() - ageMs, date, rates: { EUR: 0.5, SEK: 5 } })
const seed = (entry: FxRates) => localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(entry))
const stubFetch = (impl: (...args: unknown[]) => Promise<unknown>) => {
  const spy = vi.fn(impl)
  vi.stubGlobal('fetch', spy)
  return spy
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-10-21T12:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('loadRates', () => {
  it('fetches the Frankfurter URL when there is no cache, validates and caches the result', async () => {
    const fetchSpy = stubFetch(async () => okResponse())
    const { data, stale } = await loadRates()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe(FX_URL)
    expect(stale).toBe(false)
    expect(data).toEqual({ fetchedAt: Date.now(), date: '2026-10-21', rates: { EUR: 0.89, SEK: 9.8785 } })
    expect(JSON.parse(localStorage.getItem(FX_STORAGE_KEY)!)).toEqual(data)
  })

  it('a cache entry under 24h old makes no request', async () => {
    const entry = cacheEntry(FX_TTL_MS - 1000)
    seed(entry)
    const fetchSpy = stubFetch(async () => okResponse())
    expect(await loadRates()).toEqual({ data: entry, stale: false })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('an expired cache entry is refreshed', async () => {
    seed(cacheEntry(FX_TTL_MS + 1000))
    const fetchSpy = stubFetch(async () => okResponse())
    const { data, stale } = await loadRates()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(stale).toBe(false)
    expect(data.rates.EUR).toBe(0.89)
  })

  it('a failed fetch with an expired cache uses the stale rates', async () => {
    const entry = cacheEntry(FX_TTL_MS + 1000)
    seed(entry)
    stubFetch(async () => {
      throw new Error('offline')
    })
    expect(await loadRates()).toEqual({ data: entry, stale: true })
  })

  it('a failed fetch without a cache rejects', async () => {
    stubFetch(async () => {
      throw new Error('offline')
    })
    await expect(loadRates()).rejects.toThrow('offline')
  })

  it('an HTTP error, bad JSON content or an invalid body counts as a failure', async () => {
    stubFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    await expect(loadRates()).rejects.toThrow('HTTP 503')
    stubFetch(async () => okResponse({ ...body, base: 'EUR' }))
    await expect(loadRates()).rejects.toThrow('not valid')
    stubFetch(async () => okResponse({ ...body, rates: { EUR: -1 } }))
    await expect(loadRates()).rejects.toThrow('not valid')
    expect(localStorage.getItem(FX_STORAGE_KEY)).toBeNull()
  })

  it('never fetches twice while a request is in flight', async () => {
    let resolve!: (r: Response) => void
    const fetchSpy = stubFetch(() => new Promise<Response>((r) => (resolve = r)))
    const first = loadRates()
    const second = loadRates()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    resolve(okResponse())
    const [a, b] = await Promise.all([first, second])
    expect(a.data).toEqual(b.data)
    // Settled: the next call (cache now fresh) still makes no request.
    await loadRates()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('aborts after the timeout and falls back to stale rates', async () => {
    const entry = cacheEntry(FX_TTL_MS + 1000)
    seed(entry)
    let signal!: AbortSignal
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          signal = (init as RequestInit).signal as AbortSignal
          signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const pending = loadRates()
    await vi.advanceTimersByTimeAsync(FX_TIMEOUT_MS - 1)
    expect(signal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(signal.aborted).toBe(true)
    expect(await pending).toEqual({ data: entry, stale: true })
  })

  it('a timeout without any cache rejects', async () => {
    stubFetch((_url, init) => new Promise((_r, reject) => {
      ;(init as RequestInit).signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    const pending = loadRates()
    const assertion = expect(pending).rejects.toThrow('aborted')
    await vi.advanceTimersByTimeAsync(FX_TIMEOUT_MS)
    await assertion
  })

  it('still works when storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    stubFetch(async () => okResponse())
    expect((await loadRates()).data.rates.EUR).toBe(0.89)
    expect(readCachedRates()).toBeNull()
    expect(readStoredCurrency()).toBe('USD')
    expect(() => writeStoredCurrency('SEK')).not.toThrow()
  })
})

describe('cache and stored currency', () => {
  it('re-validates cached data on read', () => {
    for (const bad of ['not json', 'null', '5', JSON.stringify({ fetchedAt: 'x', date: '2026-10-01', rates: { EUR: 1 } }),
      JSON.stringify({ fetchedAt: 1, date: 'x', rates: { EUR: 1 } }), JSON.stringify({ fetchedAt: 1, date: '2026-10-01', rates: { EUR: -1 } })]) {
      localStorage.setItem(FX_STORAGE_KEY, bad)
      expect(readCachedRates()).toBeNull()
    }
    expect(readCachedRates()).toBeNull()
  })

  it('isFresh rejects expired and future-dated entries', () => {
    expect(isFresh(cacheEntry(1000))).toBe(true)
    expect(isFresh(cacheEntry(FX_TTL_MS))).toBe(false)
    expect(isFresh(cacheEntry(-60_000))).toBe(false)
  })

  it('the stored currency round-trips, and an unknown code is USD', () => {
    expect(readStoredCurrency()).toBe('USD')
    writeStoredCurrency('SEK')
    expect(localStorage.getItem(CURRENCY_STORAGE_KEY)).toBe('SEK')
    expect(readStoredCurrency()).toBe('SEK')
    localStorage.setItem(CURRENCY_STORAGE_KEY, 'DOGE')
    expect(readStoredCurrency()).toBe('USD')
  })
})

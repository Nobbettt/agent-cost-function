import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { stat } from './test-summary'
import { CURRENCY_STORAGE_KEY, FX_STORAGE_KEY, FX_TTL_MS } from './data/fx'

// Chart.js does not run in jsdom: expose the currency props the real chart would receive.
vi.mock('./components/CostChart', async () => ({ CostChart: (await import('./test-chart-mock')).CostChartMock }))

const body = { amount: 1, base: 'USD', date: '2026-10-21', rates: { EUR: 0.9, SEK: 10, GBP: 0.8 } }
const okResponse = (json: unknown = body) => ({ ok: true, status: 200, json: async () => json }) as Response
const stubFetch = (impl: () => Promise<unknown> = async () => okResponse()) => {
  const spy = vi.fn(impl)
  vi.stubGlobal('fetch', spy)
  return spy
}
const seedCache = (ageMs: number, rates: Record<string, number> = { EUR: 0.5, SEK: 5 }) =>
  localStorage.setItem(FX_STORAGE_KEY, JSON.stringify({ fetchedAt: Date.now() - ageMs, date: '2026-10-01', rates }))

const select = () => screen.getByLabelText('Currency') as HTMLSelectElement
const summary = () => `${stat('Setup A').value} | ${stat('Setup B').value}`
const pick = (code: string) => fireEvent.change(select(), { target: { value: code } })

describe('currency: USD default', () => {
  it('shows USD and makes no network request', async () => {
    const fetchSpy = stubFetch()
    render(<App />)
    await Promise.resolve()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(select().value).toBe('USD')
    expect(summary()).toBe('$42.55 | $55.93')
    expect(document.querySelector('.rate-status, .rate-info')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Cumulative cost vs context size' })).toBeTruthy()
    expect(screen.getByTestId('chart-cum').getAttribute('data-currency')).toBe('USD')
    expect(screen.getByTestId('chart-cum').getAttribute('data-rate')).toBe('1')
    expect(screen.getByTestId('chart-req').getAttribute('data-sample')).toBe('$1235')
  })

  it('offers the curated currencies in order, all enabled before any rates are known', () => {
    stubFetch()
    render(<App />)
    const options = within(select()).getAllByRole('option') as HTMLOptionElement[]
    expect(options.map((o) => o.value)).toEqual(['USD', 'EUR', 'SEK', 'GBP', 'NOK', 'DKK', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'INR'])
    expect(options.some((o) => o.disabled)).toBe(false)
  })

  it('the select sits in the navbar, which has no Settings button', () => {
    stubFetch()
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav.contains(select())).toBe(true)
    expect(within(nav).queryByRole('button', { name: /settings/i })).toBeNull()
  })
})

describe('currency: selecting another currency', () => {
  it('fetches once and converts the summary cards, tables and charts; shows the rate info', async () => {
    const fetchSpy = stubFetch()
    render(<App />)
    pick('SEK')
    expect(screen.getByText('Loading exchange rate…')).toBeTruthy()
    await screen.findByText(/Shown in SEK at 1 USD = 10 SEK/)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(summary()).toBe('SEK 426 | SEK 559')
    expect(stat('Setup C').value.replace(/\s/g, ' ')).toBe('SEK 259')
    expect(stat('Cheapest').value).toBe('Setup C')
    expect(stat('Cheapest').sub.replace(/\s/g, ' ')).toBe('saves SEK 300 (54%) vs Setup B')
    expect(stat('Compared at')).toEqual({ value: '995K tokens', sub: 'context size' })
    const line = document.querySelector('.rate-info')!
    expect(line.textContent!.replace(/\s/g, ' ')).toBe('Shown in SEK at 1 USD = 10 SEK · ECB reference rate 2026-10-21 via Frankfurter')
    const link = within(line as HTMLElement).getByRole('link', { name: 'Frankfurter' })
    expect([link.getAttribute('href'), link.getAttribute('target'), link.getAttribute('rel')]).toEqual(['https://frankfurter.dev', '_blank', 'noopener'])
    // The unit lives on the chart (y-axis title and values), not in the card titles.
    expect(screen.getByRole('heading', { name: 'Cumulative cost vs context size' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Cost per request vs context size' })).toBeTruthy()
    for (const metric of ['cum', 'req']) {
      expect(screen.getByTestId(`chart-${metric}`).getAttribute('data-currency')).toBe('SEK')
      expect(screen.getByTestId(`chart-${metric}`).getAttribute('data-rate')).toBe('10')
      expect(screen.getByTestId(`chart-${metric}`).getAttribute('data-sample')!.replace(/\s/g, ' ')).toBe('SEK 12345')
    }
    // Breakdown totals: A $42.55 -> SEK 426, B $55.93 -> SEK 559, vs cheapest in SEK.
    const cells = screen.getByText('A: Claude Opus 5.5, 5m, high, reasoning kept').closest('tr')!.textContent!.replace(/\s/g, ' ')
    expect(cells).toContain('SEK 426')
    expect(screen.getByText('B: Claude Opus 5.5, 1h, high, reasoning kept').closest('tr')!.lastElementChild!.textContent!.replace(/\s/g, ' ')).toBe('+SEK 300')
    expect(localStorage.getItem(CURRENCY_STORAGE_KEY)).toBe('SEK')
  })

  it('switching between fetched currencies makes no further request and EUR converts too', async () => {
    const fetchSpy = stubFetch()
    render(<App />)
    pick('SEK')
    await screen.findByText(/Shown in SEK/)
    pick('EUR')
    await screen.findByText(/Shown in EUR at 1 USD = 0.9 EUR/)
    expect(summary()).toBe('€38.30 | €50.33')
    pick('USD')
    expect(summary()).toBe('$42.55 | $55.93')
    expect(document.querySelector('.rate-status, .rate-info')).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('disables currencies missing from the fetched rates (never USD)', async () => {
    stubFetch()
    render(<App />)
    pick('SEK')
    await screen.findByText(/Shown in SEK/)
    const disabled = (within(select()).getAllByRole('option') as HTMLOptionElement[]).filter((o) => o.disabled).map((o) => o.value)
    expect(disabled).toEqual(['NOK', 'DKK', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'INR'])
  })
})

describe('currency: where the rate text goes', () => {
  const steps = () => screen.getByText('Cumulative cost at regular steps (table view)').closest('details')!
  const results = () => screen.getByRole('region', { name: 'Results' })

  it('the rate info sits after the steps table, outside the results, once SEK is in use', async () => {
    stubFetch()
    render(<App />)
    pick('SEK')
    await screen.findByText(/Shown in SEK at 1 USD = 10 SEK/)
    const info = document.querySelector('.rate-info')!
    expect(info.compareDocumentPosition(steps()) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(steps().nextElementSibling).toBe(info)
    expect(results().contains(info)).toBe(false)
    expect(document.querySelector('.rate-status')).toBeNull()
    // Nothing left under the cards: no empty element, no gap.
    expect(document.querySelector('.summary-block')!.children).toHaveLength(1)
  })

  it('loading feedback stays directly under the summary cards, with no rate info yet', async () => {
    let finish!: (r: Response) => void
    stubFetch(() => new Promise<Response>((resolve) => (finish = resolve)))
    render(<App />)
    pick('SEK')
    const status = screen.getByText('Loading exchange rate…')
    expect(status.getAttribute('role')).toBe('status')
    expect(status.previousElementSibling).toBe(document.querySelector('.summary'))
    expect(results().contains(status)).toBe(true)
    expect(document.querySelector('.rate-info')).toBeNull()
    // Settle the request so it does not stay in flight for the next test; the status gives way to the info.
    finish(okResponse())
    await screen.findByText(/Shown in SEK at 1 USD = 10 SEK/)
    expect(document.querySelector('.rate-status')).toBeNull()
  })

  it('the failure notice stays directly under the summary cards, with no rate info', async () => {
    stubFetch(async () => {
      throw new Error('offline')
    })
    render(<App />)
    pick('SEK')
    const status = await screen.findByText("Couldn't load exchange rates, showing USD.")
    expect(status.previousElementSibling).toBe(document.querySelector('.summary'))
    expect(results().contains(status)).toBe(true)
    expect(document.querySelector('.rate-info')).toBeNull()
  })

  it('USD shows neither, and leaves no empty element under the cards', () => {
    stubFetch()
    render(<App />)
    expect(document.querySelector('.rate-status, .rate-info')).toBeNull()
    expect(document.querySelector('.summary-block')!.children).toHaveLength(1)
  })
})

describe('currency: persistence', () => {
  it('restores a stored currency and uses a fresh cache without any request', async () => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, 'EUR')
    seedCache(1000, { EUR: 0.5, SEK: 5 })
    const fetchSpy = stubFetch()
    render(<App />)
    expect(select().value).toBe('EUR')
    await screen.findByText(/Shown in EUR at 1 USD = 0.5 EUR · ECB reference rate 2026-10-01/)
    expect(summary()).toBe('€21.28 | €27.96')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('restores a stored currency with no cache by fetching once', async () => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, 'SEK')
    const fetchSpy = stubFetch()
    render(<App />)
    expect(select().value).toBe('SEK')
    await screen.findByText(/Shown in SEK at 1 USD = 10 SEK/)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('an unknown stored code falls back to USD without a request', async () => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, 'DOGE')
    const fetchSpy = stubFetch()
    render(<App />)
    await Promise.resolve()
    expect(select().value).toBe('USD')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('refreshes an expired cache', async () => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, 'SEK')
    seedCache(FX_TTL_MS + 1000)
    const fetchSpy = stubFetch()
    render(<App />)
    await screen.findByText(/1 USD = 10 SEK · ECB reference rate 2026-10-21/)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

describe('currency: failures', () => {
  it('no rate at all: shows USD with a notice, never NaN', async () => {
    const fetchSpy = stubFetch(async () => {
      throw new Error('offline')
    })
    render(<App />)
    pick('SEK')
    await screen.findByText("Couldn't load exchange rates, showing USD.")
    expect(select().value).toBe('SEK')
    expect(summary()).toBe('$42.55 | $55.93')
    expect(screen.getByRole('heading', { name: 'Cumulative cost vs context size' })).toBeTruthy()
    expect(screen.getByTestId('chart-cum').getAttribute('data-currency')).toBe('USD')
    expect(screen.getByTestId('chart-cum').getAttribute('data-rate')).toBe('1')
    expect(document.body.textContent).not.toContain('NaN')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('an invalid response is a failure too', async () => {
    stubFetch(async () => okResponse({ ...body, base: 'EUR' }))
    render(<App />)
    pick('SEK')
    await screen.findByText("Couldn't load exchange rates, showing USD.")
  })

  it('a failed refresh with a stale cache keeps using the stale rate and says so', async () => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, 'SEK')
    seedCache(FX_TTL_MS + 1000)
    stubFetch(async () => {
      throw new Error('offline')
    })
    render(<App />)
    await screen.findByText(/couldn't refresh, showing the last known rate/)
    expect(document.querySelector('.rate-info')!.textContent).toContain('1 USD = 5 SEK · ECB reference rate 2026-10-01')
    expect(stat('Setup A').value).toBe('SEK 213')
  })

  it('a stored code missing from the fetched rates falls back to USD with the notice', async () => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, 'JPY')
    stubFetch()
    render(<App />)
    await screen.findByText("Couldn't load exchange rates, showing USD.")
    expect(stat('Setup A').value).toBe('$42.55')
  })

  it('works when storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    stubFetch()
    render(<App />)
    expect(select().value).toBe('USD')
    pick('EUR')
    await waitFor(() => expect(stat('Setup A').value).toBe('€38.30'))
  })
})

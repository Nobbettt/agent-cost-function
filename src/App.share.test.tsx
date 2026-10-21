import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { CURRENCY_STORAGE_KEY } from './data/fx'
import { stat } from './test-summary'

vi.mock('./components/CostChart', async () => ({ CostChart: (await import('./test-chart-mock')).CostChartMock }))

const at = (url: string) => window.history.replaceState(null, '', url)
const box = (id: string) => within(screen.getByRole('group', { name: `Setup ${id}` }))
const groups = () => [...document.querySelectorAll<HTMLElement>('#settings-panel .setup[data-id]')].map((g) => g.dataset.id)
const body = { amount: 1, base: 'USD', date: '2026-10-21', rates: { EUR: 0.9, SEK: 10 } }

const LINK = '/?v=1&a=claude-opus-5-5,1h,low,dropped,2&c=gpt-5.6-sol,30m,medium,kept,4&adv=500000,10000,7000,800,0,100,400,900,2000,4000&cur=SEK'

describe('loading from a link', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body })))
  })

  it('shows the decoded setups with their letters, values, shared numbers and currency', async () => {
    at(LINK)
    render(<App />)
    expect(groups()).toEqual(['A', 'C'])
    expect((box('A').getByLabelText('Prompt cache') as HTMLSelectElement).value).toBe('1h')
    expect((box('A').getByLabelText('Reasoning effort') as HTMLSelectElement).value).toBe('low')
    expect((box('A').getByLabelText('Cache breaking interruptions') as HTMLInputElement).value).toBe('2')
    expect((box('C').getByLabelText('Model') as HTMLSelectElement).value).toBe('gpt-5.6-sol')
    expect((box('C').getByLabelText('Cache breaking interruptions') as HTMLInputElement).value).toBe('4')
    expect((screen.getByLabelText('Added per request (K tokens)') as HTMLInputElement).value).toBe('7')
    expect((screen.getByLabelText('Reasoning: max (K tokens)') as HTMLInputElement).value).toBe('4')
    expect((screen.getByLabelText('Currency') as HTMLSelectElement).value).toBe('SEK')
    expect(stat('Setup A').sub).toBe('Claude Opus 5.5 · 1 hour cache · 2 cache breaks')
    expect(stat('Setup C').sub).toBe('GPT-5.6 Sol · 30 min cache · 4 cache breaks')
    expect(screen.getByTestId('chart-cum').getAttribute('data-ids')).toBe('A,C')
    expect(screen.getByTestId('chart-cum').getAttribute('data-xmax')).toBe('500000')
    await screen.findByText(/Shown in SEK/)
  })

  it('an adv link in raw tokens still decodes to the same values, which the UI shows in thousands', () => {
    at('/?v=1&a=claude-opus-5-5,5m,high,kept,6&b=claude-opus-5-5,1h,high,kept,1&c=claude-opus-5-5,5m,high,kept,0&adv=1000000,20000,5000,500,0,300,1000,2500,5000,10000')
    render(<App />)
    fireEvent.click(document.getElementById('advanced-toggle')!)
    const shown = ['Session length (K tokens)', 'Prompt + tools (K tokens)', 'Added per request (K tokens)', 'Output per request (K tokens)',
      'Reasoning: none (K tokens)', 'Reasoning: low (K tokens)', 'Reasoning: medium (K tokens)', 'Reasoning: high (K tokens)', 'Reasoning: xhigh (K tokens)', 'Reasoning: max (K tokens)']
    expect(shown.map((l) => (screen.getByLabelText(l) as HTMLInputElement).value)).toEqual(['1000', '20', '5', '0.5', '0', '0.3', '1', '2.5', '5', '10'])
    expect(stat('Setup A').value).toBe('$40.22')
  })

  it('a non-default adv link keeps its raw token values and shows them in thousands', () => {
    at('/?v=1&a=claude-opus-5-5,5m,high,kept,6&b=claude-opus-5-5,1h,high,kept,1&adv=500000,12500,7500,300,0,300,1000,2500,5000,10000')
    render(<App />)
    fireEvent.click(document.getElementById('advanced-toggle')!)
    expect((screen.getByLabelText('Session length (K tokens)') as HTMLInputElement).value).toBe('500')
    expect((screen.getByLabelText('Prompt + tools (K tokens)') as HTMLInputElement).value).toBe('12.5')
    expect((screen.getByLabelText('Added per request (K tokens)') as HTMLInputElement).value).toBe('7.5')
    expect((screen.getByLabelText('Output per request (K tokens)') as HTMLInputElement).value).toBe('0.3')
    expect(screen.getByTestId('chart-cum').getAttribute('data-xmax')).toBe('500000')
  })

  it('persists a link currency as the stored choice', () => {
    at('/?v=1&cur=EUR')
    render(<App />)
    expect(localStorage.getItem(CURRENCY_STORAGE_KEY)).toBe('EUR')
  })

  it('a valid cur wins over the stored currency', () => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, 'EUR')
    at('/?v=1&cur=SEK')
    render(<App />)
    expect((screen.getByLabelText('Currency') as HTMLSelectElement).value).toBe('SEK')
  })

  it('an invalid cur is ignored, so the stored currency applies', () => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, 'EUR')
    at('/?v=1&cur=XYZ')
    render(<App />)
    expect((screen.getByLabelText('Currency') as HTMLSelectElement).value).toBe('EUR')
  })

  it('opens on the first setup of the link', () => {
    at('/?v=1&b=claude-opus-5-5,1h,high,kept,3&c=claude-opus-5-5,5m,high,kept,1')
    render(<App />)
    expect(groups()).toEqual(['B', 'C'])
    expect(document.getElementById('setup-B-toggle')!.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById('setup-C-toggle')!.getAttribute('aria-expanded')).toBe('false')
  })

  it('a damaged link falls back gracefully: bad model dropped, bad adv ignored, no notice', () => {
    at('/?v=1&a=nope,5m,high,kept,2&b=claude-opus-5-5,24h,none,kept,999&adv=1,2,3')
    render(<App />)
    expect(groups()).toEqual(['A', 'B'])
    expect((box('B').getByLabelText('Prompt cache') as HTMLSelectElement).value).toBe('5m')
    expect((box('B').getByLabelText('Cache breaking interruptions') as HTMLInputElement).value).toBe('50')
    expect((screen.getByLabelText('Session length (K tokens)') as HTMLInputElement).value).toBe('1000')
    expect(screen.queryByText(/newer version/)).toBeNull()
  })

  it('a newer version shows the defaults and the notice', () => {
    at('/?v=9&a=claude-opus-5-5,1h,low,kept,2&b=gpt-5.5,24h,low,dropped,1&cur=SEK')
    render(<App />)
    expect(screen.getByText('This link was made with a newer version of the calculator; showing the defaults.').getAttribute('role')).toBe('status')
    expect(groups()).toEqual(['A', 'B', 'C'])
    expect(stat('Setup A').sub).toBe('Claude Opus 5.5 · 5 min cache · 6 cache breaks')
    expect((screen.getByLabelText('Currency') as HTMLSelectElement).value).toBe('USD')
  })

  it('the defaults show no notice', () => {
    render(<App />)
    expect(screen.queryByText(/newer version/)).toBeNull()
  })
})

describe('the address bar follows the state', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('the defaults keep a clean URL and never call replaceState', () => {
    const spy = vi.spyOn(window.history, 'replaceState')
    render(<App />)
    act(() => { vi.advanceTimersByTime(500) })
    expect(spy).not.toHaveBeenCalled()
    expect(window.location.search).toBe('')
  })

  it('a change updates the query after the debounce, without a history entry', () => {
    const spy = vi.spyOn(window.history, 'replaceState')
    const length = window.history.length
    render(<App />)
    fireEvent.change(box('B').getByLabelText('Cache breaking interruptions'), { target: { value: '2' } })
    act(() => { vi.advanceTimersByTime(249) })
    expect(spy).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(window.location.search).toBe('?v=1&a=claude-opus-5-5,5m,high,kept,6&b=claude-opus-5-5,1h,high,kept,2&c=claude-opus-5-5,5m,high,kept,0')
    expect(window.history.length).toBe(length)
  })

  it('adding a setup, changing shared numbers and the currency all show up, and undoing it all is clean again', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add setup' }))
    fireEvent.change(screen.getByLabelText('Added per request (K tokens)'), { target: { value: '7' } })
    act(() => { vi.advanceTimersByTime(300) })
    const query = new URLSearchParams(window.location.search)
    expect(query.get('v')).toBe('1')
    expect(query.get('c')).toBe('claude-opus-5-5,5m,high,kept,0')
    expect(query.get('d')).toBe('claude-opus-5-5,5m,high,kept,0')
    // The link stays in raw tokens: 7 (K) typed is 7000 tokens.
    expect(query.get('adv')).toBe('1000000,20000,7000,500,0,300,1000,2500,5000,10000')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Setup D' }))
    fireEvent.change(screen.getByLabelText('Added per request (K tokens)'), { target: { value: '5' } })
    act(() => { vi.advanceTimersByTime(300) })
    expect(window.location.search).toBe('')
  })

  it('removing a default setup leaves a link that decodes to exactly the two that remain', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Setup C' }))
    act(() => { vi.advanceTimersByTime(300) })
    expect(window.location.search).toBe('?v=1&a=claude-opus-5-5,5m,high,kept,6&b=claude-opus-5-5,1h,high,kept,1')
  })

  it('the share button copies the same link as the address bar', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<App />)
    fireEvent.change(box('B').getByLabelText('Cache breaking interruptions'), { target: { value: '2' } })
    act(() => { vi.advanceTimersByTime(300) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Share link' })) })
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${window.location.pathname}${window.location.search}`)
    Reflect.deleteProperty(navigator, 'clipboard')
  })

  it('the share button sits in the navbar before the currency select', () => {
    render(<App />)
    const share = screen.getByRole('button', { name: 'Share link' })
    const currency = screen.getByLabelText('Currency')
    expect(share.compareDocumentPosition(currency) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Main' }).contains(share)).toBe(true)
  })
})

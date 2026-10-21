import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETUPS, DEFAULT_SHARED } from '../data/defaults'
import { MODELS } from '../data/pricing'
import { avgBreakCost, breakEven, costCurve } from '../model/breakEven'
import { switchModel } from '../model/normalize'
import { mockMatchMedia } from '../test-matchmedia'
import { stat } from '../test-summary'
import { CacheBreakEvenPage } from './CacheBreakEvenPage'

vi.mock('./BreakEvenChart', async () => ({ BreakEvenChart: (await import('../test-be-chart-mock')).BreakEvenChartMock }))

const chart = () => screen.getByTestId('be-chart')
const attr = (name: string) => chart().getAttribute(`data-${name}`)!
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement
const money = (usd: number) => `$${usd.toFixed(2)}`
const body = { amount: 1, base: 'USD', date: '2026-10-21', rates: { SEK: 10 } }

beforeEach(() => mockMatchMedia(true))
afterEach(() => vi.unstubAllGlobals())

describe('Claude Cache Break-even page: content', () => {
  it('has the question as its heading, with the two-sentence lede', () => {
    render(<CacheBreakEvenPage />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe("When does Claude's 1-hour cache pay off?")
    const lede = document.querySelector('.lede')!.textContent!
    expect(lede).toContain('2× the input price')
    expect(lede).toContain('survives pauses of up to an hour')
    expect(lede).toContain('longer than 5 minutes')
  })

  it('shows the default numbers on four cards: break-even 1.3, 5 min $25.93, 1 hour $28.92, $2.38 per interruption', () => {
    render(<CacheBreakEvenPage />)
    expect(document.querySelector('.summary')!.getAttribute('data-count')).toBe('4')
    expect(stat('Break-even')).toEqual({ value: '1.3 interruptions', sub: '1 hour cache is cheaper from 2 interruptions' })
    expect(stat('5 min cache, no interruptions')).toEqual({ value: '$25.93', sub: 'session cost' })
    expect(stat('1 hour cache')).toEqual({ value: '$28.92', sub: 'same for any number of these pauses' })
    expect(stat('Each interruption (5 min cache)')).toEqual({ value: '$2.38', sub: 'average re-write cost' })
  })

  it('feeds the chart the 0..12 curve for both caches and the break-even marker', () => {
    render(<CacheBreakEvenPage />)
    expect(attr('ks')).toBe(Array.from({ length: 13 }, (_, k) => k).join(','))
    expect(new Set(attr('cost1h').split(',')).size).toBe(1)
    expect(attr('cost5').split(',')[0]).toBe('25.9325')
    expect(attr('exact')).toBe('1.2587')
    expect(attr('marker')).toBe('break-even ≈ 1.3')
    expect(attr('currency')).toBe('USD')
  })

  it('explains the pause model: only the 5 minute cache breaks, and the calculator counts differently', () => {
    render(<CacheBreakEvenPage />)
    const notes = document.querySelector('.notes')!
    expect(notes.querySelectorAll('li')).toHaveLength(3)
    expect(notes.textContent).toContain('longer than 5 minutes but shorter than an hour')
    expect(notes.textContent).toContain('never the 1-hour cache')
    expect(notes.textContent).toContain('counts every interruption as breaking every cache')
    expect(notes.textContent).toContain('longer than an hour break both caches and are not modelled')
    expect(within(notes as HTMLElement).getByRole('link', { name: 'how it is calculated' }).getAttribute('href')).toBe('/how-it-works/')
    expect(within(notes as HTMLElement).getByRole('link', { name: 'sources' }).getAttribute('href')).toBe('/sources/')
  })

  it('has the cost table collapsed, with who is cheaper at each count', () => {
    render(<CacheBreakEvenPage />)
    const details = document.querySelector('details.card') as HTMLDetailsElement
    expect(details.open).toBe(false)
    const rows = [...details.querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.textContent))
    expect(rows).toHaveLength(13)
    expect(rows[0]).toEqual(['0', '$25.93', '$28.92', '5 min'])
    expect(rows[1][3]).toBe('5 min')
    expect(rows[2]).toEqual(['2', '$30.70', '$28.92', '1 hour'])
    expect([...details.querySelectorAll('thead th')].map((h) => h.textContent)).toEqual(['Interruptions', '5 min cache', '1 hour cache', 'Cheaper'])
  })
})

describe('Claude Cache Break-even page: settings', () => {
  it('offers only Claude models, starting on Opus 5.5 with high effort and kept reasoning', () => {
    render(<CacheBreakEvenPage />)
    const model = field('Model') as HTMLSelectElement
    expect(model.value).toBe('claude-opus-5-5')
    const options = [...model.options].map((o) => o.value)
    expect(options.length).toBeGreaterThan(3)
    expect(options.every((k) => MODELS[k].provider === 'claude')).toBe(true)
    expect(options).toContain('claude-fable-5-1')
    expect((field('Reasoning effort') as HTMLSelectElement).value).toBe('high')
    expect((field('Earlier reasoning in context') as HTMLSelectElement).value).toBe('kept')
    expect((field('Session length (K tokens)') as HTMLInputElement).value).toBe('1000')
    expect((field('Interruptions shown') as HTMLInputElement).value).toBe('12')
  })

  it('changing the model updates the cards and the chart, as the model says', () => {
    render(<CacheBreakEvenPage />)
    fireEvent.change(field('Model'), { target: { value: 'claude-fable-5-1' } })
    const expected = costCurve(switchModel(DEFAULT_SETUPS.A, 'claude-fable-5-1'), DEFAULT_SHARED, 12)
    expect(stat('5 min cache, no interruptions').value).toBe(money(expected[0].cost5))
    expect(stat('1 hour cache').value).toBe(money(expected[0].cost1h))
    expect(stat('Each interruption (5 min cache)').value).toBe(money(avgBreakCost(expected)))
    expect(stat('Break-even').value).toBe(`${breakEven(expected).exact!.toFixed(1)} interruptions`)
    expect(stat('5 min cache, no interruptions').value).not.toBe('$25.93')
    expect(attr('cost5').split(',')[0]).toBe(expected[0].cost5.toFixed(4))
  })

  it('changing the effort changes the costs (more reasoning is more output)', () => {
    render(<CacheBreakEvenPage />)
    fireEvent.change(field('Reasoning effort'), { target: { value: 'max' } })
    const expected = costCurve({ ...DEFAULT_SETUPS.A, effort: 'max' }, DEFAULT_SHARED, 12)
    expect(stat('5 min cache, no interruptions').value).toBe(money(expected[0].cost5))
    expect(stat('5 min cache, no interruptions').value).not.toBe('$25.93')
  })

  it('filters the reasoning effort options per model, falling back like the calculator', () => {
    render(<CacheBreakEvenPage />)
    fireEvent.change(field('Reasoning effort'), { target: { value: 'xhigh' } })
    fireEvent.change(field('Model'), { target: { value: 'claude-sonnet-4-6' } })
    const efforts = [...(field('Reasoning effort') as HTMLSelectElement).options].map((o) => o.value)
    expect(efforts).toEqual(MODELS['claude-sonnet-4-6'].efforts)
    expect(efforts).not.toContain('xhigh')
    expect((field('Reasoning effort') as HTMLSelectElement).value).toBe('high')
  })

  it('clamps "Interruptions shown" to 4..40 while keeping what was typed', () => {
    render(<CacheBreakEvenPage />)
    const shown = field('Interruptions shown') as HTMLInputElement
    expect([shown.min, shown.max, shown.step]).toEqual(['4', '40', '1'])
    fireEvent.change(shown, { target: { value: '100' } })
    expect(shown.value).toBe('100')
    expect(attr('count')).toBe('41')
    fireEvent.change(shown, { target: { value: '1' } })
    expect(attr('count')).toBe('5')
    fireEvent.change(shown, { target: { value: '20' } })
    expect(attr('count')).toBe('21')
    fireEvent.change(shown, { target: { value: '' } })
    expect(attr('count')).toBe('13')
  })

  it('says there is no break-even when there is none within the interruptions shown (a session too short to run)', () => {
    render(<CacheBreakEvenPage />)
    fireEvent.change(field('Session length (K tokens)'), { target: { value: '10' } })
    expect(stat('Break-even')).toEqual({ value: 'None up to 12', sub: '5 min cache stays cheaper' })
    expect(attr('exact')).toBe('none')
    expect(attr('marker')).toBe('')
  })

  it('has the Advanced settings collapsed, with every field of the calculator except the session length shown above', () => {
    render(<CacheBreakEvenPage />)
    const toggle = document.getElementById('advanced-toggle')!
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById('advanced-body')!.hasAttribute('hidden')).toBe(true)
    expect(screen.getAllByLabelText('Session length (K tokens)')).toHaveLength(1)
    fireEvent.click(toggle)
    expect(document.getElementById('advanced-body')!.hasAttribute('hidden')).toBe(false)
    for (const label of ['Prompt + tools (K tokens)', 'Added per request (K tokens)', 'Output per request (K tokens)', 'Reasoning: high (K tokens)']) {
      expect(within(document.getElementById('advanced-body')!).getByLabelText(label)).toBeTruthy()
    }
  })

  it('an Advanced setting reaches the chart: more added tokens per request changes the cost', () => {
    render(<CacheBreakEvenPage />)
    fireEvent.click(document.getElementById('advanced-toggle')!)
    fireEvent.change(screen.getByLabelText('Added per request (K tokens)'), { target: { value: '10' } })
    const expected = costCurve(DEFAULT_SETUPS.A, { ...DEFAULT_SHARED, growth: 10000 }, 12)
    expect(attr('cost5').split(',')[0]).toBe(expected[0].cost5.toFixed(4))
    expect(attr('cost5').split(',')[0]).not.toBe('25.9325')
  })

  it('has a help tip on the new field', () => {
    render(<CacheBreakEvenPage />)
    const tip = screen.getByRole('button', { name: 'About Interruptions shown' })
    expect(tip).toBeTruthy()
  })
})

describe('Claude Cache Break-even page: navigation and currency', () => {
  it('marks the break-even link as the current page in the navbar and the footer', () => {
    render(<CacheBreakEvenPage />)
    const nav = within(screen.getByRole('navigation', { name: 'Main' }))
    expect(nav.getByRole('link', { name: 'Claude Cache Break-even' }).getAttribute('aria-current')).toBe('page')
    expect(nav.getByRole('link', { name: 'Explore' }).getAttribute('aria-current')).toBeNull()
    const footer = within(within(screen.getByRole('contentinfo')).getByRole('navigation', { name: 'Site' }))
    expect(footer.getByText('Claude Cache Break-even').getAttribute('aria-current')).toBe('page')
    expect(footer.getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/', '/how-it-works/', '/sources/'])
  })

  it('from 768px up the currency select is in the navbar; below, it is the first field of the settings card', () => {
    const { unmount } = render(<CacheBreakEvenPage />)
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByLabelText('Currency')).toBeTruthy()
    expect(screen.getAllByLabelText('Currency')).toHaveLength(1)
    unmount()
    mockMatchMedia(false)
    render(<CacheBreakEvenPage />)
    expect(within(screen.getByRole('navigation', { name: 'Main' })).queryByLabelText('Currency')).toBeNull()
    const first = document.querySelector('.be-settings .fields')!.firstElementChild!
    expect(within(first as HTMLElement).getByLabelText('Currency')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Cache break-even' }).getAttribute('aria-current')).toBe('page')
  })

  it('converts every amount to the chosen currency, and the chart gets the rate', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body })))
    render(<CacheBreakEvenPage />)
    fireEvent.change(within(screen.getByRole('navigation', { name: 'Main' })).getByLabelText('Currency'), { target: { value: 'SEK' } })
    await screen.findByText(/Shown in SEK/)
    expect(stat('5 min cache, no interruptions').value.replace(/\s/g, ' ')).toBe('SEK 259')
    expect(stat('1 hour cache').value.replace(/\s/g, ' ')).toBe('SEK 289')
    expect(stat('Break-even').value).toBe('1.3 interruptions')
    expect(attr('currency')).toBe('SEK')
    expect(attr('rate')).toBe('10')
    expect(document.querySelector('details.card tbody tr')!.children[2].textContent!.replace(/\s/g, ' ')).toBe('SEK 289')
  })
})

import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETUPS, DEFAULT_SHARED } from '../data/defaults'
import { MODELS } from '../data/pricing'
import { breakEven, costCurve } from '../model/breakEven'
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

  it('shows the defaults (2 short pauses, none long) on four cards: break-even 1.3, 5 min $30.70, 1 hour $28.92, the 1 hour cache saves $1.78', () => {
    render(<CacheBreakEvenPage />)
    expect(document.querySelector('.summary')!.getAttribute('data-count')).toBe('4')
    expect(stat('Break-even')).toEqual({ value: '1.3 pauses of 5–60 min', sub: 'with 0 longer pauses; 1 hour cache cheaper from 2' })
    expect(stat('5 min cache')).toEqual({ value: '$30.70', sub: '2 cache breaks' })
    expect(stat('1 hour cache')).toEqual({ value: '$28.92', sub: 'no cache breaks' })
    expect(stat('At your pauses')).toEqual({ value: '1 hour cache', sub: 'saves $1.78 (6%)' })
    expect([...document.querySelectorAll('.summary dt')].map((d) => d.textContent)).toEqual(['Break-even', '5 min cache', '1 hour cache', 'At your pauses'])
  })

  it('feeds the chart the 0..12 curve for both caches, the break-even marker and the marker for your pauses', () => {
    render(<CacheBreakEvenPage />)
    expect(attr('ks')).toBe(Array.from({ length: 13 }, (_, k) => k).join(','))
    expect(new Set(attr('cost1h').split(',')).size).toBe(1)
    expect(attr('cost5').split(',')[0]).toBe('25.9325')
    expect(attr('exact')).toBe('1.2587')
    expect(attr('marker')).toBe('break-even ≈ 1.3')
    expect(attr('yourk')).toBe('2')
    expect(attr('currency')).toBe('USD')
  })

  it('explains the pause model: only the 5 minute cache breaks, and the calculator counts differently', () => {
    render(<CacheBreakEvenPage />)
    const notes = document.querySelector('.notes')!
    expect(notes.querySelectorAll('li')).toHaveLength(3)
    expect(notes.textContent).toContain('A pause of 5–60 minutes (longer than 5 minutes, up to an hour) breaks only the 5-minute cache')
    expect(notes.textContent).toContain('A pause over an hour breaks both caches, and the 1-hour cache then pays 2× input for the re-write')
    expect(notes.textContent).toContain('counts every interruption as breaking every cache')
    expect(notes.textContent).toContain('Each kind of pause is spread evenly over the session.')
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
    expect([...details.querySelectorAll('thead th')].map((h) => h.textContent)).toEqual(['Pauses of 5–60 min', '5 min cache', '1 hour cache', 'Cheaper'])
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
    expect((field('Pauses 5–60 min') as HTMLInputElement).value).toBe('2')
    expect((field('Pauses over 60 min') as HTMLInputElement).value).toBe('0')
    expect((field('Chart range (5–60 min pauses)') as HTMLInputElement).value).toBe('12')
  })

  it('changing the model updates the cards and the chart, as the model says', () => {
    render(<CacheBreakEvenPage />)
    fireEvent.change(field('Model'), { target: { value: 'claude-fable-5-1' } })
    const expected = costCurve(switchModel(DEFAULT_SETUPS.A, 'claude-fable-5-1'), DEFAULT_SHARED, 12)
    expect(stat('5 min cache').value).toBe(money(expected[2].cost5))
    expect(stat('1 hour cache').value).toBe(money(expected[2].cost1h))
    expect(stat('Break-even').value).toBe(`${breakEven(expected).exact!.toFixed(1)} pauses of 5–60 min`)
    expect(stat('5 min cache').value).not.toBe('$30.70')
    expect(attr('cost5').split(',')[0]).toBe(expected[0].cost5.toFixed(4))
  })

  it('changing the effort changes the costs (more reasoning is more output)', () => {
    render(<CacheBreakEvenPage />)
    fireEvent.change(field('Reasoning effort'), { target: { value: 'max' } })
    const expected = costCurve({ ...DEFAULT_SETUPS.A, effort: 'max' }, DEFAULT_SHARED, 12)
    expect(stat('5 min cache').value).toBe(money(expected[2].cost5))
    expect(stat('5 min cache').value).not.toBe('$30.70')
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

  it('clamps "Chart range (5–60 min pauses)" to 4..40 while keeping what was typed', () => {
    render(<CacheBreakEvenPage />)
    const shown = field('Chart range (5–60 min pauses)') as HTMLInputElement
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

  it('has both pause fields with their limits (0 to 40), defaults, notes and help', () => {
    render(<CacheBreakEvenPage />)
    for (const [label, value, note] of [['Pauses 5–60 min', '2', 'Break the 5 min cache only.'], ['Pauses over 60 min', '0', 'Break both caches.']] as const) {
      const input = field(label) as HTMLInputElement
      expect([input.value, input.min, input.max, input.step]).toEqual([value, '0', '40', '1'])
      expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toBe(note)
      expect(screen.getByRole('button', { name: `About ${label}` })).toBeTruthy()
    }
    const tip = (label: string) => document.getElementById(screen.getByRole('button', { name: `About ${label}` }).getAttribute('aria-describedby')!)!.textContent
    expect(tip('Pauses 5–60 min')).toBe('Pauses longer than 5 minutes but no longer than an hour. Each one makes the 5-minute cache write the whole context again; the 1-hour cache survives it.')
    expect(tip('Pauses over 60 min')).toBe('Pauses longer than an hour. Both caches expire, so both write the whole context again; the 1-hour cache pays 2× input for it.')
    expect(tip('Chart range (5–60 min pauses)')).toBe('How many pauses of 5–60 min the chart covers. It is extended to fit your pauses if they are more.')
  })

  it('clamps and rounds the pause counts, and falls back to the defaults when emptied', () => {
    render(<CacheBreakEvenPage />)
    const short = field('Pauses 5–60 min') as HTMLInputElement
    const long = field('Pauses over 60 min') as HTMLInputElement
    fireEvent.change(short, { target: { value: '99' } })
    expect(short.value).toBe('99')
    expect(attr('yourk')).toBe('40')
    fireEvent.change(short, { target: { value: '-3' } })
    expect(attr('yourk')).toBe('0')
    fireEvent.change(short, { target: { value: '' } })
    expect(attr('yourk')).toBe('2')
    fireEvent.change(long, { target: { value: '2.6' } })
    expect(stat('1 hour cache').sub).toBe('3 cache breaks')
    fireEvent.change(long, { target: { value: '' } })
    expect(stat('1 hour cache').sub).toBe('no cache breaks')
  })

  it('longer pauses move the break-even up and change the cards: 1 gives 1.9, 2 gives 2.5, 3 gives 3.1', () => {
    render(<CacheBreakEvenPage />)
    const long = field('Pauses over 60 min') as HTMLInputElement
    const cases: [string, string, string, string][] = [
      ['1', '1.9 pauses of 5–60 min', 'with 1 longer pause; 1 hour cache cheaper from 2', '3 cache breaks'],
      ['2', '2.5 pauses of 5–60 min', 'with 2 longer pauses; 1 hour cache cheaper from 3', '4 cache breaks'],
      ['3', '3.1 pauses of 5–60 min', 'with 3 longer pauses; 1 hour cache cheaper from 4', '5 cache breaks'],
    ]
    for (const [n, value, sub, breaks] of cases) {
      fireEvent.change(long, { target: { value: n } })
      expect(stat('Break-even')).toEqual({ value, sub })
      expect(stat('5 min cache').sub).toBe(breaks)
      expect(stat('1 hour cache').sub).toBe(n === '1' ? '1 cache break' : `${n} cache breaks`)
      const expected = costCurve(DEFAULT_SETUPS.A, DEFAULT_SHARED, 12, Number(n))
      expect(stat('5 min cache').value).toBe(money(expected[2].cost5))
      expect(stat('1 hour cache').value).toBe(money(expected[2].cost1h))
      expect(attr('cost1h').split(',')[0]).toBe(expected[0].cost1h.toFixed(4))
    }
    // With 3 longer pauses and 2 short ones the 5 minute cache is now the cheaper one.
    expect(stat('At your pauses').value).toBe('5 min cache')
    expect(stat('At your pauses').sub).toMatch(/^saves \$\d+\.\d\d \(\d+%\)$/)
  })

  it('"At your pauses" names the cheaper cache with the saving', () => {
    render(<CacheBreakEvenPage />)
    expect(stat('At your pauses')).toEqual({ value: '1 hour cache', sub: 'saves $1.78 (6%)' })
    fireEvent.change(field('Pauses 5–60 min'), { target: { value: '0' } })
    expect(stat('At your pauses')).toEqual({ value: '5 min cache', sub: 'saves $2.98 (10%)' })
  })

  it('extends the chart range when your 5–60 min pauses are beyond it (short + 2, at most 40), with a note', () => {
    render(<CacheBreakEvenPage />)
    const short = field('Pauses 5–60 min') as HTMLInputElement
    fireEvent.change(short, { target: { value: '30' } })
    expect(attr('count')).toBe('33')
    expect(attr('ks').split(',').at(-1)).toBe('32')
    expect(attr('yourk')).toBe('30')
    const range = field('Chart range (5–60 min pauses)') as HTMLInputElement
    expect(range.value).toBe('12')
    expect(document.getElementById(range.getAttribute('aria-describedby')!)!.textContent).toBe('Showing up to 32 so your pauses fit.')
    fireEvent.change(short, { target: { value: '40' } })
    expect(attr('count')).toBe('41')
    fireEvent.change(short, { target: { value: '12' } })
    expect(attr('count')).toBe('13')
    expect(range.getAttribute('aria-describedby')).toBeNull()
  })

  it('the marker follows your pauses and the break-even marker stays where it is', () => {
    render(<CacheBreakEvenPage />)
    fireEvent.change(field('Pauses 5–60 min'), { target: { value: '7' } })
    expect(attr('yourk')).toBe('7')
    expect(attr('marker')).toBe('break-even ≈ 1.3')
  })

  it('says there is no break-even when there is none within the chart range (a session too short to run)', () => {
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
    expect(stat('5 min cache').value.replace(/\s/g, ' ')).toBe('SEK 307')
    expect(stat('1 hour cache').value.replace(/\s/g, ' ')).toBe('SEK 289')
    expect(stat('At your pauses').sub.replace(/\s/g, ' ')).toBe('saves SEK 17.79 (6%)')
    expect(stat('Break-even').value).toBe('1.3 pauses of 5–60 min')
    expect(attr('currency')).toBe('SEK')
    expect(attr('rate')).toBe('10')
    expect(document.querySelector('details.card tbody tr')!.children[2].textContent!.replace(/\s/g, ' ')).toBe('SEK 289')
  })
})

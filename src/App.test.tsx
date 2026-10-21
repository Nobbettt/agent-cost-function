import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { MODELS, PRICES_CHECKED } from './data/pricing'
import { stat, summaryText } from './test-summary'
import type { SetupId } from './model/types'

// Chart.js does not run in jsdom; expose the props the real chart would receive.
vi.mock('./components/CostChart', async () => ({ CostChart: (await import('./test-chart-mock')).CostChartMock }))

const setupBox = (id: SetupId) => within(screen.getByRole('group', { name: `Setup ${id}` }))
const DEFAULT_SUMMARY = 'Setup A$42.55Claude Opus 5.5 · 5 min cacheSetup B$55.93Claude Opus 5.5 · 1 hour cacheSetup C$25.93Claude Opus 5.5 · 5 min cacheCheapestSetup Csaves $29.99 (54%) vs Setup BCompared at995K tokenscontext size'

describe('App', () => {
  it('renders the default summary cards', () => {
    render(<App />)
    expect(stat('Setup A')).toEqual({ value: '$42.55', sub: 'Claude Opus 5.5 · 5 min cache' })
    expect(stat('Setup B')).toEqual({ value: '$55.93', sub: 'Claude Opus 5.5 · 1 hour cache' })
    expect(stat('Setup C')).toEqual({ value: '$25.93', sub: 'Claude Opus 5.5 · 5 min cache' })
    expect(stat('Cheapest')).toEqual({ value: 'Setup C', sub: 'saves $29.99 (54%) vs Setup B' })
    expect(stat('Compared at')).toEqual({ value: '995K tokens', sub: 'context size' })
    expect(summaryText().replace(/ /g, '')).toBe(DEFAULT_SUMMARY.replace(/ /g, ''))
  })

  it('is a Summary region of five definition-list cards, with series keys on the three setups only', () => {
    render(<App />)
    const summary = screen.getByRole('region', { name: 'Summary' })
    expect(summary.querySelectorAll('dl > .stat')).toHaveLength(5)
    expect(summary.getAttribute('data-count')).toBe('5')
    expect(summary.querySelectorAll('dt .key')).toHaveLength(3)
    expect([...summary.querySelectorAll('dt svg.key line')].map((l) => l.getAttribute('stroke'))).toEqual(['var(--series-a)', 'var(--series-b)', 'var(--series-c)'])
    expect(document.getElementById('headline')).toBeNull()
  })

  it('says when one model stops earlier at its max input', () => {
    render(<App />)
    fireEvent.click(setupBox('A').getByLabelText('OpenAI'))
    expect(stat('Compared at')).toEqual({ value: '920K tokens', sub: 'One model stops earlier at its max input' })
    expect(stat('Setup A').sub).toBe('GPT-5.6 Sol · 30 min cache')
  })

  it('has a Settings aside and a Results section, with the results first in DOM order', () => {
    render(<App />)
    const settings = screen.getByRole('complementary', { name: 'Settings' })
    const results = screen.getByRole('region', { name: 'Results' })
    expect(settings.tagName).toBe('ASIDE')
    expect(results.tagName).toBe('SECTION')
    expect(results.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(settings).getByRole('group', { name: 'Setup A' })).toBeTruthy()
    expect(within(settings).getByRole('group', { name: 'Setup B' })).toBeTruthy()
    expect(within(settings).getByText('Advanced settings')).toBeTruthy()
    expect(within(results).getByTestId('chart-cum')).toBeTruthy()
    expect(within(results).getByTestId('chart-req')).toBeTruthy()
    expect(results.querySelector('.summary')).toBeTruthy()
  })

  it('puts Advanced settings first in the panel, collapsed, then Setup A, then Setup B', () => {
    render(<App />)
    const settings = screen.getByRole('complementary', { name: 'Settings' })
    const advanced = settings.querySelector<HTMLElement>('#advanced')!
    expect(advanced.querySelector('#advanced-toggle')!.textContent).toBe('Advanced settings')
    expect(advanced.querySelector('#advanced-toggle')!.getAttribute('aria-expanded')).toBe('false')
    expect((advanced.querySelector('#advanced-body') as HTMLElement).hidden).toBe(true)
    const a = within(settings).getByRole('group', { name: 'Setup A' })
    const b = within(settings).getByRole('group', { name: 'Setup B' })
    expect(advanced.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(settings.firstElementChild).toBe(advanced)
  })

  it('no longer says "Shared assumptions" anywhere', () => {
    render(<App />)
    expect(document.body.textContent).not.toMatch(/shared assumptions/i)
    const tips = [...document.querySelectorAll('[role="tooltip"]')].map((t) => t.textContent)
    expect(tips.some((t) => t!.includes('is set in Advanced settings.'))).toBe(true)
  })

  it('keeps the breakdown and steps tables outside the results', () => {
    render(<App />)
    const results = screen.getByRole('region', { name: 'Results' })
    expect(results.contains(screen.getByText('vs cheapest'))).toBe(false)
    expect(results.contains(screen.getByText('Cumulative cost at regular steps (table view)'))).toBe(false)
  })

  it('feeds both charts with the three runs', () => {
    render(<App />)
    for (const metric of ['cum', 'req']) {
      const chart = screen.getByTestId(`chart-${metric}`)
      expect(chart.getAttribute('data-last')).toBe('995000,995000,995000')
      expect(chart.getAttribute('data-dashes')).toBe('solid,solid,6 3')
      expect(chart.getAttribute('data-xmax')).toBe('1000000')
    }
  })

  it('gives each setup its own radiogroup of real radio inputs', () => {
    render(<App />)
    const groups = screen.getAllByRole('radiogroup', { hidden: true })
    expect(groups).toHaveLength(3)
    const names = groups.map((g) => new Set(within(g).getAllByRole('radio', { hidden: true }).map((r) => (r as HTMLInputElement).name)))
    expect(names.map((n) => [...n])).toEqual([['provider-A'], ['provider-B'], ['provider-C']])
    expect((setupBox('A').getByLabelText('Claude') as HTMLInputElement).checked).toBe(true)
    expect((setupBox('B').getByLabelText('Claude') as HTMLInputElement).checked).toBe(true)
    expect((setupBox('B').getByLabelText('OpenAI') as HTMLInputElement).checked).toBe(false)
  })

  it('starts with Opus 5.5 on a 5 min, a 1 hour and a 5 min cache with 7, 7 and 0 cache breaking interruptions', () => {
    render(<App />)
    for (const [id, cache, breaks] of [['A', '5m', '7'], ['B', '1h', '7'], ['C', '5m', '0']] as const) {
      const box = setupBox(id)
      expect((box.getByLabelText('Model') as HTMLSelectElement).value).toBe('claude-opus-5-5')
      expect((box.getByLabelText('Prompt cache') as HTMLSelectElement).value).toBe(cache)
      expect((box.getByLabelText('Reasoning effort') as HTMLSelectElement).value).toBe('high')
      expect((box.getByLabelText('Earlier reasoning in context') as HTMLSelectElement).value).toBe('kept')
      expect((box.getByLabelText('Cache breaking interruptions') as HTMLInputElement).value).toBe(breaks)
      expect(box.queryByLabelText('Pause per interruption (min)')).toBeNull()
    }
  })

  it('switching provider selects its default model and resets cache, effort and reasoning', () => {
    render(<App />)
    const a = setupBox('A')
    fireEvent.change(a.getByLabelText('Reasoning effort'), { target: { value: 'low' } })
    fireEvent.change(a.getByLabelText('Prompt cache'), { target: { value: '1h' } })
    fireEvent.click(a.getByLabelText('OpenAI'))
    expect((a.getByLabelText('Model') as HTMLSelectElement).value).toBe('gpt-5.6-sol')
    expect((a.getByLabelText('Prompt cache') as HTMLSelectElement).value).toBe('30m')
    expect((a.getByLabelText('Reasoning effort') as HTMLSelectElement).value).toBe('medium')
    expect((a.getByLabelText('Earlier reasoning in context') as HTMLSelectElement).value).toBe('kept')
    // Setup B is untouched.
    expect((setupBox('B').getByLabelText('Model') as HTMLSelectElement).value).toBe('claude-opus-5-5')
    expect((setupBox('B').getByLabelText('Prompt cache') as HTMLSelectElement).value).toBe('1h')
  })

  it('lists only the provider\'s models, with "(default)" on documented defaults', () => {
    render(<App />)
    const a = setupBox('A')
    const models = within(a.getByLabelText('Model')).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)
    expect(models).toEqual(Object.keys(MODELS).filter((k) => MODELS[k].provider === 'claude'))
    // Opus 5.5 documents medium as its default effort and 'kept' as its reasoning default.
    expect(a.getByRole('option', { name: 'medium (default)' })).toBeTruthy()
    expect(a.getByRole('option', { name: 'kept (default)' })).toBeTruthy()
  })

  it('switching model keeps allowed values and falls back otherwise', () => {
    render(<App />)
    const a = setupBox('A')
    fireEvent.change(a.getByLabelText('Reasoning effort'), { target: { value: 'low' } })
    fireEvent.change(a.getByLabelText('Prompt cache'), { target: { value: '1h' } })
    fireEvent.change(a.getByLabelText('Model'), { target: { value: 'claude-sonnet-5-5' } })
    expect((a.getByLabelText('Reasoning effort') as HTMLSelectElement).value).toBe('low')
    expect((a.getByLabelText('Prompt cache') as HTMLSelectElement).value).toBe('1h')

    fireEvent.change(a.getByLabelText('Reasoning effort'), { target: { value: 'xhigh' } })
    fireEvent.change(a.getByLabelText('Model'), { target: { value: 'claude-sonnet-4-6' } })
    expect((a.getByLabelText('Reasoning effort') as HTMLSelectElement).value).toBe('high')
  })

  it('clamps numbers to their range but keeps showing what was typed', () => {
    render(<App />)
    const session = screen.getByLabelText('Session length (tokens)') as HTMLInputElement
    fireEvent.change(session, { target: { value: '5' } })
    expect(session.value).toBe('5')
    expect(stat('Compared at').value).toBe('10K tokens')
    expect(screen.getByTestId('chart-cum').getAttribute('data-xmax')).toBe('10000')
  })

  it('falls back to the default when a number field is emptied', () => {
    render(<App />)
    const interruptions = setupBox('A').getByLabelText('Cache breaking interruptions') as HTMLInputElement
    const before = summaryText()
    fireEvent.change(interruptions, { target: { value: '0' } })
    expect(summaryText()).not.toBe(before)
    fireEvent.change(interruptions, { target: { value: '' } })
    expect(summaryText()).toBe(before)
  })

  it('keeps the min, max and step attributes of the prototype', () => {
    render(<App />)
    const breaks = setupBox('B').getByLabelText('Cache breaking interruptions')
    expect([breaks.getAttribute('min'), breaks.getAttribute('max'), breaks.getAttribute('step')]).toEqual(['0', '50', '1'])
    const growth = screen.getByLabelText('Added per request (tokens)')
    expect([growth.getAttribute('min'), growth.getAttribute('max'), growth.getAttribute('step')]).toEqual(['500', '200000', '500'])
  })

  it('shows the breakdown and steps tables', () => {
    render(<App />)
    expect(screen.getByText('A: Claude Opus 5.5, 5m, high, reasoning kept')).toBeTruthy()
    expect(screen.getByText('B: Claude Opus 5.5, 1h, high, reasoning kept')).toBeTruthy()
    expect(screen.getByText('vs cheapest')).toBeTruthy()
    const vs = (label: string) => screen.getByText(label).closest('tr')!.lastElementChild!.textContent
    expect(vs('A: Claude Opus 5.5, 5m, high, reasoning kept')).toBe('+$16.62')
    expect(vs('B: Claude Opus 5.5, 1h, high, reasoning kept')).toBe('+$29.99')
    expect(vs('C: Claude Opus 5.5, 5m, high, reasoning kept')).toBe('cheapest')
    // No run is capped by default, so every step has a cost.
    expect(screen.queryAllByText('—')).toHaveLength(0)
    // GPT-5.6 Sol stops at 922K, so the 1M step shows a dash for that setup.
    fireEvent.click(setupBox('A').getByLabelText('OpenAI'))
    expect(screen.getAllByText('—')).toHaveLength(1)
  })

  it('no longer renders the sources table or the notes, but links to both subpages from the footer', () => {
    render(<App />)
    expect(document.querySelector('table.sources')).toBeNull()
    expect(screen.queryByRole('heading', { name: /sources|how it is calculated/i })).toBeNull()
    expect(screen.queryByText(/Every request sends the whole context/)).toBeNull()
    const footer = screen.getByRole('contentinfo')
    expect(footer.textContent).toContain(`Prices and settings checked ${PRICES_CHECKED}`)
    const nav = within(footer).getByRole('navigation', { name: 'Site' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((l) => [l.textContent, l.getAttribute('href'), l.getAttribute('target')])).toEqual([
      ['How it is calculated', '/how-it-works/', null],
      ['Sources', '/sources/', null],
    ])
  })
})

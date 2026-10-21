import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { MODELS, PRICES_CHECKED } from './data/pricing'
import { stat, summaryText } from './test-summary'
import type { Run } from './model/types'

// Chart.js does not run in jsdom; expose the props the real chart would receive.
vi.mock('./components/CostChart', () => ({
  CostChart: ({ runs, metric, xMax }: { runs: [Run, Run]; metric: string; xMax: number }) => (
    <div data-testid={`chart-${metric}`} data-xmax={xMax} data-last={runs.map((r) => r.points.at(-1)?.x).join(',')} />
  ),
}))

const setupBox = (id: 'A' | 'B') => within(screen.getByRole('group', { name: `Setup ${id}` }))
const DEFAULT_SUMMARY = 'Setup A$42.55Claude Opus 5.5 · 5 min cacheSetup B$28.92Claude Opus 5.5 · 1 hour cacheDifference (B − A)−$13.63B is 32% cheaperCompared at995K tokenscontext size'

describe('App', () => {
  it('renders the default summary cards', () => {
    render(<App />)
    expect(stat('Setup A')).toEqual({ value: '$42.55', sub: 'Claude Opus 5.5 · 5 min cache' })
    expect(stat('Setup B')).toEqual({ value: '$28.92', sub: 'Claude Opus 5.5 · 1 hour cache' })
    expect(stat('Difference (B − A)')).toEqual({ value: '−$13.63', sub: 'B is 32% cheaper' })
    expect(stat('Compared at')).toEqual({ value: '995K tokens', sub: 'context size' })
    expect(summaryText().replace(/ /g, '')).toBe(DEFAULT_SUMMARY.replace(/ /g, ''))
  })

  it('is a Summary region of four definition-list cards, with series keys on the setups only', () => {
    render(<App />)
    const summary = screen.getByRole('region', { name: 'Summary' })
    expect(summary.querySelectorAll('dl > .stat')).toHaveLength(4)
    expect(summary.querySelectorAll('dt .key')).toHaveLength(2)
    expect(summary.querySelector('.stat[data-series="A"] dt .key')).toBeTruthy()
    expect(summary.querySelector('.stat[data-series="B"] dt .key')).toBeTruthy()
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
    expect(within(settings).getByText('Shared assumptions')).toBeTruthy()
    expect(within(results).getByTestId('chart-cum')).toBeTruthy()
    expect(within(results).getByTestId('chart-req')).toBeTruthy()
    expect(results.querySelector('.summary')).toBeTruthy()
  })

  it('keeps the breakdown and steps tables outside the results', () => {
    render(<App />)
    const results = screen.getByRole('region', { name: 'Results' })
    expect(results.contains(screen.getByText('B − A'))).toBe(false)
    expect(results.contains(screen.getByText('Cumulative cost at regular steps (table view)'))).toBe(false)
  })

  it('feeds both charts with the two runs', () => {
    render(<App />)
    for (const metric of ['cum', 'req']) {
      const chart = screen.getByTestId(`chart-${metric}`)
      expect(chart.getAttribute('data-last')).toBe('995000,995000')
      expect(chart.getAttribute('data-xmax')).toBe('1000000')
    }
  })

  it('gives each setup its own radiogroup of real radio inputs', () => {
    render(<App />)
    const groups = screen.getAllByRole('radiogroup')
    expect(groups).toHaveLength(2)
    const names = groups.map((g) => new Set(within(g).getAllByRole('radio').map((r) => (r as HTMLInputElement).name)))
    expect(names.map((n) => [...n])).toEqual([['provider-A'], ['provider-B']])
    expect((setupBox('A').getByLabelText('Claude') as HTMLInputElement).checked).toBe(true)
    expect((setupBox('B').getByLabelText('Claude') as HTMLInputElement).checked).toBe(true)
    expect((setupBox('B').getByLabelText('OpenAI') as HTMLInputElement).checked).toBe(false)
  })

  it('starts with the cache TTL comparison: Opus 5.5 on a 5 min and a 1 hour cache, 7 pauses of 6 min', () => {
    render(<App />)
    for (const [id, cache] of [['A', '5m'], ['B', '1h']] as const) {
      const box = setupBox(id)
      expect((box.getByLabelText('Model') as HTMLSelectElement).value).toBe('claude-opus-5-5')
      expect((box.getByLabelText('Prompt cache') as HTMLSelectElement).value).toBe(cache)
      expect((box.getByLabelText('Reasoning effort') as HTMLSelectElement).value).toBe('high')
      expect((box.getByLabelText('Earlier reasoning in context') as HTMLSelectElement).value).toBe('kept')
      expect((box.getByLabelText('Interruptions') as HTMLInputElement).value).toBe('7')
      expect((box.getByLabelText('Pause per interruption (min)') as HTMLInputElement).value).toBe('6')
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
    const interruptions = setupBox('A').getByLabelText('Interruptions') as HTMLInputElement
    const before = summaryText()
    fireEvent.change(interruptions, { target: { value: '0' } })
    expect(summaryText()).not.toBe(before)
    fireEvent.change(interruptions, { target: { value: '' } })
    expect(summaryText()).toBe(before)
  })

  it('keeps the min, max and step attributes of the prototype', () => {
    render(<App />)
    const pause = setupBox('B').getByLabelText('Pause per interruption (min)')
    expect([pause.getAttribute('min'), pause.getAttribute('max'), pause.getAttribute('step')]).toEqual(['0', '1440', '1'])
    const growth = screen.getByLabelText('Added per request (tokens)')
    expect([growth.getAttribute('min'), growth.getAttribute('max'), growth.getAttribute('step')]).toEqual(['500', '200000', '500'])
  })

  it('shows the breakdown and steps tables', () => {
    render(<App />)
    expect(screen.getByText('A: Claude Opus 5.5, 5m, high, reasoning kept')).toBeTruthy()
    expect(screen.getByText('B: Claude Opus 5.5, 1h, high, reasoning kept')).toBeTruthy()
    expect(screen.getByText('B − A')).toBeTruthy()
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

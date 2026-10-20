import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { MODELS, PRICES_CHECKED } from './data/pricing'
import type { Run } from './model/types'

// Chart.js does not run in jsdom; expose the props the real chart would receive.
vi.mock('./components/CostChart', () => ({
  CostChart: ({ runs, metric, xMax }: { runs: [Run, Run]; metric: string; xMax: number }) => (
    <div data-testid={`chart-${metric}`} data-xmax={xMax} data-last={runs.map((r) => r.points.at(-1)?.x).join(',')} />
  ),
}))

const setupBox = (id: 'A' | 'B') => within(screen.getByRole('group', { name: `Setup ${id}` }))
const headline = () => document.getElementById('headline')!.textContent
const DEFAULT_HEADLINE = 'At 920K tokens of context: A $30.18 · B $60.64. A is 50% cheaper. One model stops earlier at its max input.'

describe('App', () => {
  it('renders the default headline from the prototype', () => {
    render(<App />)
    expect(headline()).toBe(DEFAULT_HEADLINE)
  })

  it('feeds both charts with the two runs', () => {
    render(<App />)
    for (const metric of ['cum', 'req']) {
      const chart = screen.getByTestId(`chart-${metric}`)
      expect(chart.getAttribute('data-last')).toBe('995000,920000')
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
    expect((setupBox('B').getByLabelText('OpenAI') as HTMLInputElement).checked).toBe(true)
    expect((setupBox('B').getByLabelText('Claude') as HTMLInputElement).checked).toBe(false)
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
    expect((setupBox('B').getByLabelText('Model') as HTMLSelectElement).value).toBe('gpt-5.6-sol')
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
    expect(headline()).toContain('At 10K tokens of context')
    expect(screen.getByTestId('chart-cum').getAttribute('data-xmax')).toBe('10000')
  })

  it('falls back to the default when a number field is emptied', () => {
    render(<App />)
    const interruptions = setupBox('A').getByLabelText('Interruptions') as HTMLInputElement
    fireEvent.change(interruptions, { target: { value: '0' } })
    expect(headline()).not.toBe(DEFAULT_HEADLINE)
    fireEvent.change(interruptions, { target: { value: '' } })
    expect(headline()).toBe(DEFAULT_HEADLINE)
  })

  it('keeps the min, max and step attributes of the prototype', () => {
    render(<App />)
    const pause = setupBox('B').getByLabelText('Pause per interruption (min)')
    expect([pause.getAttribute('min'), pause.getAttribute('max'), pause.getAttribute('step')]).toEqual(['0', '1440', '1'])
    const growth = screen.getByLabelText('New context per request, excl. reasoning (tokens)')
    expect([growth.getAttribute('min'), growth.getAttribute('max'), growth.getAttribute('step')]).toEqual(['500', '200000', '500'])
  })

  it('shows the breakdown and steps tables', () => {
    render(<App />)
    expect(screen.getByText('A: Claude Opus 5.5, 5m, high, reasoning kept')).toBeTruthy()
    expect(screen.getByText('B − A')).toBeTruthy()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('no longer renders the sources table, but links to the sources page from the footer', () => {
    render(<App />)
    expect(document.querySelector('table.sources')).toBeNull()
    expect(screen.queryByRole('heading', { name: /sources/i })).toBeNull()
    const footer = screen.getByRole('contentinfo')
    expect(footer.textContent).toContain(`Prices and settings checked ${PRICES_CHECKED}`)
    const link = within(footer).getByRole('link', { name: 'Sources' })
    expect(link.getAttribute('href')).toBe('/sources/')
    expect(link.getAttribute('target')).toBeNull()
  })
})

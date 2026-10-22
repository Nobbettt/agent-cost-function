import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { DEFAULT_SETUP_LIST, DEFAULT_SETUPS, DEFAULT_SHARED } from './data/defaults'
import { ALL_EFFORTS, MODELS, PRICES_CHECKED } from './data/pricing'
import { fmtUsd } from './format'
import { simulate } from './model/simulate'
import { stat, summaryText } from './test-summary'
import type { SetupId } from './model/types'

// Chart.js does not run in jsdom; expose the props the real chart would receive.
vi.mock('./components/CostChart', async () => ({ CostChart: (await import('./test-chart-mock')).CostChartMock }))

const setupBox = (id: SetupId) => within(screen.getByRole('group', { name: `Setup ${id}` }))
const DEFAULT_SUMMARY = 'Setup A$40.22Opus 5.5 · 5 min cache · 6 cache breaksSetup B$32.76Opus 5.5 · 1 hour cache · 1 cache breakSetup C$25.93Opus 5.5 · 5 min cache · no cache breaksCheapestSetup Csaves $14.29 (36%) vs Setup ACompared at995K tokenscontext size'

describe('App', () => {
  it('renders the default summary cards', () => {
    render(<App />)
    expect(stat('Setup A')).toEqual({ value: '$40.22', sub: 'Opus 5.5 · 5 min cache · 6 cache breaks' })
    expect(stat('Setup B')).toEqual({ value: '$32.76', sub: 'Opus 5.5 · 1 hour cache · 1 cache break' })
    expect(stat('Setup C')).toEqual({ value: '$25.93', sub: 'Opus 5.5 · 5 min cache · no cache breaks' })
    expect(stat('Cheapest')).toEqual({ value: 'Setup C', sub: 'saves $14.29 (36%) vs Setup A' })
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
    expect(stat('Setup A').sub).toBe('GPT-5.6 Sol · 30 min cache · 6 cache breaks')
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
    expect(settings.querySelector('.settings-body')!.firstElementChild).toBe(advanced)
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
    const groups = screen.getAllByRole('radiogroup', { hidden: true }).filter((g) => g.getAttribute('aria-label')?.startsWith('Provider for'))
    expect(groups).toHaveLength(3)
    const names = groups.map((g) => new Set(within(g).getAllByRole('radio', { hidden: true }).map((r) => (r as HTMLInputElement).name)))
    expect(names.map((n) => [...n])).toEqual([['provider-A'], ['provider-B'], ['provider-C']])
    expect((setupBox('A').getByLabelText('Claude') as HTMLInputElement).checked).toBe(true)
    expect((setupBox('B').getByLabelText('Claude') as HTMLInputElement).checked).toBe(true)
    expect((setupBox('B').getByLabelText('OpenAI') as HTMLInputElement).checked).toBe(false)
  })

  it('starts with Opus 5.5 on a 5 min, a 1 hour and a 5 min cache with 6, 1 and 0 cache breaking interruptions', () => {
    render(<App />)
    for (const [id, cache, breaks] of [['A', '5m', '6'], ['B', '1h', '1'], ['C', '5m', '0']] as const) {
      const box = setupBox(id)
      expect((box.getByLabelText('Model') as HTMLSelectElement).value).toBe('claude-opus-5-5')
      expect((box.getByLabelText('Cache lifetime') as HTMLSelectElement).value).toBe(cache)
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
    fireEvent.change(a.getByLabelText('Cache lifetime'), { target: { value: '1h' } })
    fireEvent.click(a.getByLabelText('OpenAI'))
    expect((a.getByLabelText('Model') as HTMLSelectElement).value).toBe('gpt-5.6-sol')
    expect(a.getByLabelText('Cache lifetime').textContent).toBe('30 min (fixed)')
    expect((a.getByLabelText('Reasoning effort') as HTMLSelectElement).value).toBe('medium')
    expect((a.getByLabelText('Earlier reasoning in context') as HTMLSelectElement).value).toBe('kept')
    // Setup B is untouched.
    expect((setupBox('B').getByLabelText('Model') as HTMLSelectElement).value).toBe('claude-opus-5-5')
    expect((setupBox('B').getByLabelText('Cache lifetime') as HTMLSelectElement).value).toBe('1h')
  })

  it('has four providers in each setup: Claude, OpenAI, xAI and Google, with unique radio names per setup', () => {
    render(<App />)
    for (const id of ['A', 'B', 'C'] as const) {
      const group = setupBox(id).getByRole('radiogroup', { name: `Provider for Setup ${id}`, hidden: true })
      const radios = within(group).getAllByRole('radio', { hidden: true }) as HTMLInputElement[]
      expect(radios.map((r) => r.value)).toEqual(['claude', 'openai', 'xai', 'google'])
      expect([...group.querySelectorAll('label')].map((l) => l.textContent)).toEqual(['Claude', 'OpenAI', 'xAI', 'Google'])
      expect(new Set(radios.map((r) => r.name))).toEqual(new Set([`provider-${id}`]))
    }
    expect(new Set([...document.querySelectorAll<HTMLInputElement>('input[type=radio][name^="provider-"]')].map((r) => r.id)).size).toBe(12)
  })

  it('switching a setup to xAI selects Grok 4.7 with the best-effort cache, high effort and kept reasoning, and the card says so', () => {
    render(<App />)
    const c = setupBox('C')
    fireEvent.click(c.getByLabelText('xAI'))
    expect((c.getByLabelText('Model') as HTMLSelectElement).value).toBe('grok-4.7')
    expect(c.getByLabelText('Cache').textContent).toBe('Automatic')
    expect(c.queryByRole('combobox', { name: 'Cache' })).toBeNull()
    expect((c.getByLabelText('Reasoning effort') as HTMLSelectElement).value).toBe('high')
    expect([...(c.getByLabelText('Reasoning effort') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['low', 'medium', 'high (default)', 'xhigh'])
    expect((c.getByLabelText('Earlier reasoning in context') as HTMLSelectElement).value).toBe('kept')
    expect(stat('Setup C').sub).toBe('Grok 4.7 · best-effort cache · no cache breaks')
    expect(stat('Compared at').sub).toBe('One model stops earlier at its max input')
    expect(stat('Compared at').value).toBe('500K tokens')
    // Back to Claude: the Opus 5.5 defaults return.
    fireEvent.click(c.getByLabelText('Claude'))
    expect((c.getByLabelText('Model') as HTMLSelectElement).value).toBe('claude-opus-5-5')
    expect((c.getByLabelText('Cache lifetime') as HTMLSelectElement).value).toBe('5m')
    expect(stat('Setup C').sub).toBe('Opus 5.5 · 5 min cache · no cache breaks')
  })

  it('switching a setup to Google selects Gemini 3.8 Flash with the implicit cache, medium effort and kept reasoning, and the card says so', () => {
    render(<App />)
    const c = setupBox('C')
    fireEvent.click(c.getByLabelText('Google'))
    expect((c.getByLabelText('Model') as HTMLSelectElement).value).toBe('gemini-3.8-flash')
    expect([...(c.getByLabelText('Model') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual([
      'Gemini 4 Argon', 'Gemini 3.8 Flash', 'Gemini 3.6 Flash', 'Gemini 3.5 Flash-Lite', 'Gemini 3.1 Pro Preview',
    ])
    expect(c.getByLabelText('Cache').textContent).toBe('Implicit (automatic)')
    expect((c.getByLabelText('Reasoning effort') as HTMLSelectElement).value).toBe('medium')
    expect([...(c.getByLabelText('Reasoning effort') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['low', 'medium (default)', 'high'])
    expect([...(c.getByLabelText('Earlier reasoning in context') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['kept (default)'])
    expect(stat('Setup C').sub).toBe('Gemini 3.8 Flash · implicit cache · no cache breaks')
    fireEvent.click(c.getByLabelText('Claude'))
    expect((c.getByLabelText('Model') as HTMLSelectElement).value).toBe('claude-opus-5-5')
    expect(stat('Setup C').sub).toBe('Opus 5.5 · 5 min cache · no cache breaks')
  })

  it('Gemini 3.5 Flash-Lite has no default effort marked and falls back to low; 3.1 Pro defaults to high', () => {
    render(<App />)
    const c = setupBox('C')
    fireEvent.click(c.getByLabelText('Google'))
    fireEvent.change(c.getByLabelText('Reasoning effort'), { target: { value: 'high' } })
    fireEvent.change(c.getByLabelText('Model'), { target: { value: 'gemini-3.5-flash-lite' } })
    expect([...(c.getByLabelText('Reasoning effort') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['low', 'medium', 'high'])
    expect((c.getByLabelText('Reasoning effort') as HTMLSelectElement).value).toBe('high')
    fireEvent.change(c.getByLabelText('Model'), { target: { value: 'gemini-3.1-pro-preview' } })
    expect([...(c.getByLabelText('Reasoning effort') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['low', 'medium', 'high (default)'])
    expect(stat('Setup C').sub).toBe('Gemini 3.1 Pro Preview · implicit cache · no cache breaks')
  })

  it('prices the calculator at today (UTC): Gemini 4 Argon on 2026-12-01 costs what the model says at that date', () => {
    const run = (iso: string) => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(`${iso}T12:00:00Z`))
      const { unmount } = render(<App />)
      const c = setupBox('C')
      fireEvent.click(c.getByLabelText('Google'))
      fireEvent.change(c.getByLabelText('Model'), { target: { value: 'gemini-4-argon' } })
      const value = stat('Setup C').value
      unmount()
      vi.useRealTimers()
      return value
    }
    const argonC = { ...DEFAULT_SETUPS.C, provider: 'google' as const, model: 'gemini-4-argon', cache: 'implicit' as const, effort: 'medium' as const, reasoning: 'kept' as const }
    const before = run('2026-11-30')
    const after = run('2026-12-01')
    // The card shows the cost at the size all setups reach (995K, where A and B end).
    const cardCost = (iso: string) => fmtUsd(simulate(argonC, DEFAULT_SHARED, iso).points.filter((pt) => pt.x <= 995000).at(-1)!.cum)
    expect(before).toBe(cardCost('2026-11-30'))
    expect(after).toBe(cardCost('2026-12-01'))
    expect(before).not.toBe(after)
  })

  it('the xAI models: grok-4.5 has no xhigh, grok-4.20 only none, and earlier reasoning is dropped except on 4.7', () => {
    render(<App />)
    const c = setupBox('C')
    fireEvent.click(c.getByLabelText('xAI'))
    fireEvent.change(c.getByLabelText('Reasoning effort'), { target: { value: 'xhigh' } })
    fireEvent.change(c.getByLabelText('Model'), { target: { value: 'grok-4.5' } })
    expect([...(c.getByLabelText('Reasoning effort') as HTMLSelectElement).options].map((o) => o.value)).toEqual(['low', 'medium', 'high'])
    expect((c.getByLabelText('Reasoning effort') as HTMLSelectElement).value).toBe('high')
    expect([...(c.getByLabelText('Earlier reasoning in context') as HTMLSelectElement).options].map((o) => o.value)).toEqual(['dropped'])
    fireEvent.change(c.getByLabelText('Model'), { target: { value: 'grok-4.20-0309-non-reasoning' } })
    expect([...(c.getByLabelText('Reasoning effort') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['none'])
    expect(stat('Setup C').sub).toBe('Grok 4.20 (non-reasoning) · best-effort cache · no cache breaks')
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
    fireEvent.change(a.getByLabelText('Cache lifetime'), { target: { value: '1h' } })
    fireEvent.change(a.getByLabelText('Model'), { target: { value: 'claude-sonnet-5-5' } })
    expect((a.getByLabelText('Reasoning effort') as HTMLSelectElement).value).toBe('low')
    expect((a.getByLabelText('Cache lifetime') as HTMLSelectElement).value).toBe('1h')

    fireEvent.change(a.getByLabelText('Reasoning effort'), { target: { value: 'xhigh' } })
    fireEvent.change(a.getByLabelText('Model'), { target: { value: 'claude-sonnet-4-6' } })
    expect((a.getByLabelText('Reasoning effort') as HTMLSelectElement).value).toBe('high')
  })

  it('clamps numbers to their range but keeps showing what was typed', () => {
    render(<App />)
    const session = screen.getByLabelText('Session length (K tokens)') as HTMLInputElement
    fireEvent.change(session, { target: { value: '5' } })
    expect(session.value).toBe('5')
    expect(stat('Compared at').value).toBe('10K tokens')
    expect(screen.getByTestId('chart-cum').getAttribute('data-xmax')).toBe('10000')
  })

  it('shows every token field in thousands, the defaults as 1000, 20, 5, 0.5, 0, 0.3, 1, 2.5, 5, 10', () => {
    render(<App />)
    fireEvent.click(document.getElementById('advanced-toggle')!)
    const labels = ['Session length (K tokens)', 'Prompt + tools (K tokens)', 'Added per request (K tokens)', 'Output per request (K tokens)',
      ...ALL_EFFORTS.map((e) => `Reasoning: ${e} (K tokens)`)]
    expect(labels.map((l) => (screen.getByLabelText(l) as HTMLInputElement).value)).toEqual(['1000', '20', '5', '0.5', '0', '0.3', '1', '2.5', '5', '10'])
    expect(screen.queryByLabelText(/\(tokens\)/)).toBeNull()
    const limits = ['Session length (K tokens)', 'Prompt + tools (K tokens)', 'Output per request (K tokens)', 'Reasoning: high (K tokens)']
      .map((l) => { const i = screen.getByLabelText(l); return [i.getAttribute('min'), i.getAttribute('max'), i.getAttribute('step')] })
    expect(limits).toEqual([['10', '1000', '10'], ['0', '200', '1'], ['0', '64', '0.1'], ['0', '128', '0.1']])
    // The interruption count is not a token field.
    expect((setupBox('A').getByLabelText('Cache breaking interruptions') as HTMLInputElement).value).toBe('6')
  })

  it('typing thousands changes the cards as the same number of tokens would: 1 in Output per request is 1000 tokens', () => {
    render(<App />)
    fireEvent.click(document.getElementById('advanced-toggle')!)
    const shared = { ...DEFAULT_SHARED, visibleOut: 1000 }
    const expectedA = DEFAULT_SETUP_LIST.map((s) => simulate(s, shared).totals.total)
    fireEvent.change(screen.getByLabelText('Output per request (K tokens)'), { target: { value: '1' } })
    expect([stat('Setup A').value, stat('Setup B').value, stat('Setup C').value]).toEqual(expectedA.map((v) => `$${v.toFixed(2)}`))
    // 0.5 is the default again.
    fireEvent.change(screen.getByLabelText('Output per request (K tokens)'), { target: { value: '0.5' } })
    expect(stat('Setup A').value).toBe('$40.22')
    expect(stat('Setup C').value).toBe('$25.93')
  })

  it('accepts decimals, rounds to whole tokens and clamps in tokens', () => {
    render(<App />)
    fireEvent.click(document.getElementById('advanced-toggle')!)
    const out = screen.getByLabelText('Output per request (K tokens)') as HTMLInputElement
    fireEvent.change(out, { target: { value: '0.3' } })
    expect(stat('Setup C').value).toBe(fmtUsd(simulate(DEFAULT_SETUPS.C, { ...DEFAULT_SHARED, visibleOut: 300 }).totals.total))
    fireEvent.change(out, { target: { value: '9999' } })
    expect(stat('Setup C').value).toBe(fmtUsd(simulate(DEFAULT_SETUPS.C, { ...DEFAULT_SHARED, visibleOut: 64000 }).totals.total))
    expect(out.value).toBe('9999')
    fireEvent.change(out, { target: { value: '' } })
    expect(stat('Setup C').value).toBe('$25.93')
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
    const growth = screen.getByLabelText('Added per request (K tokens)')
    expect([growth.getAttribute('min'), growth.getAttribute('max'), growth.getAttribute('step')]).toEqual(['0.5', '200', '0.5'])
  })

  it('shows the breakdown and steps tables', () => {
    render(<App />)
    expect(screen.getByText('Setup A: Opus 5.5, 5m, high, reasoning kept')).toBeTruthy()
    expect(screen.getByText('Setup B: Opus 5.5, 1h, high, reasoning kept')).toBeTruthy()
    expect(screen.getByText('vs cheapest')).toBeTruthy()
    const vs = (label: string) => screen.getByText(label).closest('tr')!.lastElementChild!.textContent
    expect(vs('Setup A: Opus 5.5, 5m, high, reasoning kept')).toBe('+$14.29')
    expect(vs('Setup B: Opus 5.5, 1h, high, reasoning kept')).toBe('+$6.83')
    expect(vs('Setup C: Opus 5.5, 5m, high, reasoning kept')).toBe('cheapest')
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
      ['Claude Cache Break-even', '/cache-break-even/', null],
      ['How it is calculated', '/how-it-works/', null],
      ['Sources', '/sources/', null],
    ])
  })
})

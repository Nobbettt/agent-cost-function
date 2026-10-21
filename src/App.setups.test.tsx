import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import type { SetupId } from './model/types'
import { stat } from './test-summary'

vi.mock('./components/CostChart', async () => ({ CostChart: (await import('./test-chart-mock')).CostChartMock }))

const addBtn = () => screen.getByRole('button', { name: '+ Add setup' }) as HTMLButtonElement
const add = () => fireEvent.click(addBtn())
const groups = () => [...document.querySelectorAll<HTMLElement>('#settings-panel .setup')].map((g) => g.dataset.id)
const box = (id: SetupId) => within(screen.getByRole('group', { name: `Setup ${id}` }))
const toggle = (id: SetupId) => document.getElementById(`setup-${id}-toggle`) as HTMLButtonElement
const body = (id: SetupId) => document.getElementById(`setup-${id}-body`)!
const removeBtn = (id: SetupId) => screen.queryByRole('button', { name: `Remove setup ${id}` })
const chart = () => screen.getByTestId('chart-cum')

describe('adding setups', () => {
  it('starts with two, no remove buttons, and an enabled Add button', () => {
    render(<App />)
    expect(groups()).toEqual(['A', 'B'])
    expect(removeBtn('A')).toBeNull()
    expect(removeBtn('B')).toBeNull()
    expect(addBtn().disabled).toBe(false)
  })

  it('the new setup is a copy of the last one, with the next free letter, expanded and focused', () => {
    render(<App />)
    fireEvent.change(box('B').getByLabelText('Reasoning effort'), { target: { value: 'low' } })
    fireEvent.change(box('B').getByLabelText('Cache breaking interruptions'), { target: { value: '2' } })
    add()
    expect(groups()).toEqual(['A', 'B', 'C'])
    const c = box('C')
    expect((c.getByLabelText('Prompt cache') as HTMLSelectElement).value).toBe('1h')
    expect((c.getByLabelText('Reasoning effort') as HTMLSelectElement).value).toBe('low')
    expect((c.getByLabelText('Cache breaking interruptions') as HTMLInputElement).value).toBe('2')
    expect(toggle('C').getAttribute('aria-expanded')).toBe('true')
    expect(body('C').hidden).toBe(false)
    expect(document.activeElement).toBe(toggle('C'))
  })

  it('goes up to four; the fifth is blocked and explained', () => {
    render(<App />)
    add()
    add()
    expect(groups()).toEqual(['A', 'B', 'C', 'D'])
    expect(addBtn().disabled).toBe(true)
    expect(screen.getByText('Up to 4 setups')).toBeTruthy()
    fireEvent.click(addBtn())
    expect(groups()).toEqual(['A', 'B', 'C', 'D'])
  })

  it('editing a setup changes only that setup', () => {
    render(<App />)
    add()
    fireEvent.change(box('C').getByLabelText('Cache breaking interruptions'), { target: { value: '3' } })
    expect((box('C').getByLabelText('Cache breaking interruptions') as HTMLInputElement).value).toBe('3')
    expect((box('B').getByLabelText('Cache breaking interruptions') as HTMLInputElement).value).toBe('7')
    expect((box('A').getByLabelText('Cache breaking interruptions') as HTMLInputElement).value).toBe('7')
  })
})

describe('removing setups', () => {
  it('remove buttons appear above two setups and are named after the setup', () => {
    render(<App />)
    add()
    for (const id of ['A', 'B', 'C'] as const) expect(removeBtn(id)).toBeTruthy()
    fireEvent.click(removeBtn('C')!)
    expect(removeBtn('A')).toBeNull()
    expect(removeBtn('B')).toBeNull()
  })

  it('removing B from A, B, C leaves C with its own letter and colour variable', () => {
    render(<App />)
    add()
    fireEvent.click(removeBtn('B')!)
    expect(groups()).toEqual(['A', 'C'])
    expect(screen.queryByRole('group', { name: 'Setup B' })).toBeNull()
    expect(chart().getAttribute('data-ids')).toBe('A,C')
    expect(chart().getAttribute('data-vars')).toBe('--series-a,--series-c')
    expect(chart().getAttribute('data-dashes')).toBe('solid,6 3')
    expect(screen.getByRole('group', { name: 'Setup C' }).getAttribute('data-id')).toBe('C')
    expect(stat('Setup C')).toBeTruthy()
    expect(() => stat('Setup B')).toThrow()
  })

  it('a freed letter is reused by the next added setup', () => {
    render(<App />)
    add()
    fireEvent.click(removeBtn('B')!)
    add()
    expect(groups()).toEqual(['A', 'B', 'C'])
  })

  it('focus moves to the previous setup, or to the next when the first is removed', () => {
    render(<App />)
    add()
    add()
    fireEvent.click(removeBtn('C')!)
    expect(document.activeElement).toBe(toggle('B'))
    add()
    fireEvent.click(removeBtn('A')!)
    expect(groups()).toEqual(['B', 'C', 'D'])
    expect(document.activeElement).toBe(toggle('B'))
    fireEvent.click(removeBtn('D')!)
    expect(document.activeElement).toBe(toggle('C'))
  })
})

describe('collapsing setups', () => {
  it('toggles aria-expanded and hides the body; the summary shows only when collapsed', () => {
    render(<App />)
    const t = toggle('A')
    expect(t.getAttribute('aria-controls')).toBe('setup-A-body')
    expect(t.getAttribute('aria-expanded')).toBe('true')
    expect(body('A').hidden).toBe(false)
    expect(t.querySelector('.setup-summary')).toBeNull()
    fireEvent.click(t)
    expect(t.getAttribute('aria-expanded')).toBe('false')
    expect(body('A').hidden).toBe(true)
    expect(t.querySelector('.setup-summary')!.textContent).toBe('Claude Opus 5.5 · 5 min cache · high · reasoning kept · 7 cache breaks')
    // Other setups are untouched.
    expect(toggle('B').getAttribute('aria-expanded')).toBe('true')
    expect(body('B').hidden).toBe(false)
    fireEvent.click(t)
    expect(t.getAttribute('aria-expanded')).toBe('true')
    expect(body('A').hidden).toBe(false)
    expect(t.querySelector('.setup-summary')).toBeNull()
  })

  it('the collapsed summary follows the values and says "no cache breaks" for 0', () => {
    render(<App />)
    fireEvent.change(box('B').getByLabelText('Cache breaking interruptions'), { target: { value: '0' } })
    fireEvent.click(toggle('B'))
    expect(toggle('B').querySelector('.setup-summary')!.textContent).toBe('Claude Opus 5.5 · 1 hour cache · high · reasoning kept · no cache breaks')
  })

  it('the toggle contains no interactive content, and the remove button sits outside it', () => {
    render(<App />)
    add()
    expect(toggle('C').querySelector('button, a, input, select')).toBeNull()
    expect(toggle('C').contains(removeBtn('C'))).toBe(false)
  })

  it('collapse state survives edits elsewhere and belongs to the setup id', () => {
    render(<App />)
    add()
    fireEvent.click(toggle('B'))
    fireEvent.click(removeBtn('C')!)
    expect(toggle('B').getAttribute('aria-expanded')).toBe('false')
    add()
    expect(toggle('C').getAttribute('aria-expanded')).toBe('true')
  })
})

describe('everything follows the number of setups', () => {
  it('feeds the charts one series per setup with the right colour variable and dash', () => {
    render(<App />)
    expect(chart().getAttribute('data-ids')).toBe('A,B')
    expect(chart().getAttribute('data-vars')).toBe('--series-a,--series-b')
    expect(chart().getAttribute('data-dashes')).toBe('solid,solid')
    add()
    expect(chart().getAttribute('data-vars')).toBe('--series-a,--series-b,--series-c')
    add()
    for (const id of ['chart-cum', 'chart-req']) {
      const c = screen.getByTestId(id)
      expect(c.getAttribute('data-ids')).toBe('A,B,C,D')
      expect(c.getAttribute('data-vars')).toBe('--series-a,--series-b,--series-c,--series-d')
      expect(c.getAttribute('data-dashes')).toBe('solid,solid,6 3,2 3')
    }
  })

  it('three setups give a card each, with the cheapest measured against the most expensive', () => {
    render(<App />)
    add()
    expect(document.querySelector('.summary')!.getAttribute('data-count')).toBe('5')
    expect(stat('Setup C')).toEqual({ value: '$55.93', sub: 'Claude Opus 5.5 · 1 hour cache' })
    // C is a copy of B, so B and C tie for most expensive; the first of them is named.
    expect(stat('Cheapest')).toEqual({ value: 'Setup A', sub: 'saves $13.37 (24%) vs Setup B' })
    expect(stat('Compared at').value).toBe('995K tokens')
  })

  it('a changed third setup can become the cheapest', () => {
    render(<App />)
    add()
    fireEvent.change(box('C').getByLabelText('Model'), { target: { value: 'claude-haiku-5-5' } })
    expect(stat('Cheapest').value).toBe('Setup C')
    expect(stat('Cheapest').sub).toMatch(/^saves \$\d+\.\d\d \(\d+%\) vs Setup B$/)
  })

  it('the breakdown has a row per setup and a "vs cheapest" column; the steps table a column per setup', () => {
    render(<App />)
    add()
    const rows = [...document.querySelectorAll('table')[0].querySelectorAll('tbody tr')]
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.lastElementChild!.textContent)).toEqual(['cheapest', '+$13.37', '+$13.37'])
    const heads = [...document.querySelectorAll('table')[1].querySelectorAll('thead th')].map((h) => h.textContent)
    expect(heads).toEqual(['Context', 'Setup A', 'Setup B', 'Setup C'])
    expect(document.querySelectorAll('table')[1].querySelectorAll('tbody tr:first-child td')).toHaveLength(4)
  })

  it('four setups give six summary cards', () => {
    render(<App />)
    add()
    add()
    expect(document.querySelector('.summary')!.getAttribute('data-count')).toBe('6')
    expect(document.querySelectorAll('.summary dl > .stat')).toHaveLength(6)
  })

  it('a removal after the cheapest changes: A and C only', () => {
    render(<App />)
    add()
    fireEvent.click(removeBtn('B')!)
    expect(stat('Cheapest')).toEqual({ value: 'Setup A', sub: 'saves $13.37 (24%) vs Setup C' })
    const rows = [...document.querySelectorAll('table')[0].querySelectorAll('tbody tr')]
    expect(rows.map((r) => r.firstElementChild!.textContent!.slice(0, 2))).toEqual(['A:', 'C:'])
  })
})

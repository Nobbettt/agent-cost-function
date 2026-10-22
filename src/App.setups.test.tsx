import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import type { SetupId } from './model/types'
import { stat } from './test-summary'

vi.mock('./components/CostChart', async () => ({ CostChart: (await import('./test-chart-mock')).CostChartMock }))

const addBtn = () => screen.getByRole('button', { name: '+ Add setup' }) as HTMLButtonElement
const add = () => fireEvent.click(addBtn())
const groups = () => [...document.querySelectorAll<HTMLElement>('#settings-panel .setup[data-id]')].map((g) => g.dataset.id)
const box = (id: SetupId) => within(screen.getByRole('group', { name: `Setup ${id}` }))
const toggle = (id: SetupId) => document.getElementById(`setup-${id}-toggle`) as HTMLButtonElement
const body = (id: SetupId) => document.getElementById(`setup-${id}-body`)!
const removeBtn = (id: SetupId) => screen.queryByRole('button', { name: `Remove Setup ${id}` })
const chart = () => screen.getByTestId('chart-cum')
// The page starts with four setups; most scenarios here start from two, so drop the defaults D and C first.
function renderTwo() {
  const result = render(<App />)
  fireEvent.click(removeBtn('D')!)
  fireEvent.click(removeBtn('C')!)
  return result
}

describe('adding setups', () => {
  it('starts with the four default setups, with remove buttons and the Add button disabled and explained', () => {
    render(<App />)
    expect(groups()).toEqual(['A', 'B', 'C', 'D'])
    for (const id of ['A', 'B', 'C', 'D'] as const) expect(removeBtn(id)).toBeTruthy()
    expect(addBtn().disabled).toBe(true)
    expect(screen.getByText('Up to 4 setups')).toBeTruthy()
    fireEvent.click(addBtn())
    expect(groups()).toEqual(['A', 'B', 'C', 'D'])
  })

  it('removing a default setup frees the Add button again', () => {
    render(<App />)
    fireEvent.click(removeBtn('D')!)
    expect(addBtn().disabled).toBe(false)
    expect(screen.queryByText('Up to 4 setups')).toBeNull()
  })

  it('the default C is Opus 5.5 on the 5 minute cache with no interruptions, and D is the same on the 1 hour cache', () => {
    render(<App />)
    expect((box('C').getByLabelText('Cache lifetime') as HTMLSelectElement).value).toBe('5m')
    expect((box('C').getByLabelText('Cache breaking interruptions') as HTMLInputElement).value).toBe('0')
    expect(toggle('A').getAttribute('aria-expanded')).toBe('true')
    expect(toggle('B').getAttribute('aria-expanded')).toBe('false')
    expect(toggle('C').getAttribute('aria-expanded')).toBe('false')
    expect((box('D').getByLabelText('Cache lifetime') as HTMLSelectElement).value).toBe('1h')
    expect((box('D').getByLabelText('Cache breaking interruptions') as HTMLInputElement).value).toBe('0')
    expect(toggle('D').getAttribute('aria-expanded')).toBe('false')
  })

  it('removing D and C from the defaults leaves A and B, and the remove buttons go away', () => {
    renderTwo()
    expect(groups()).toEqual(['A', 'B'])
    expect(removeBtn('A')).toBeNull()
    expect(removeBtn('B')).toBeNull()
    expect(addBtn().disabled).toBe(false)
  })

  it('the new setup is a copy of the last one, with the next free letter, expanded and focused', () => {
    renderTwo()
    fireEvent.change(box('B').getByLabelText('Reasoning effort'), { target: { value: 'low' } })
    fireEvent.change(box('B').getByLabelText('Cache breaking interruptions'), { target: { value: '2' } })
    add()
    expect(groups()).toEqual(['A', 'B', 'C'])
    const c = box('C')
    expect((c.getByLabelText('Cache lifetime') as HTMLSelectElement).value).toBe('1h')
    expect((c.getByLabelText('Reasoning effort') as HTMLSelectElement).value).toBe('low')
    expect((c.getByLabelText('Cache breaking interruptions') as HTMLInputElement).value).toBe('2')
    expect(toggle('C').getAttribute('aria-expanded')).toBe('true')
    expect(body('C').hidden).toBe(false)
    expect(toggle('A').getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle('C'))
  })

  it('goes up to four; the fifth is blocked and explained', () => {
    renderTwo()
    add()
    add()
    expect(groups()).toEqual(['A', 'B', 'C', 'D'])
    expect(addBtn().disabled).toBe(true)
    expect(screen.getByText('Up to 4 setups')).toBeTruthy()
    fireEvent.click(addBtn())
    expect(groups()).toEqual(['A', 'B', 'C', 'D'])
  })

  it('editing a setup changes only that setup', () => {
    renderTwo()
    add()
    fireEvent.change(box('C').getByLabelText('Cache breaking interruptions'), { target: { value: '3' } })
    expect((box('C').getByLabelText('Cache breaking interruptions') as HTMLInputElement).value).toBe('3')
    expect((box('B').getByLabelText('Cache breaking interruptions') as HTMLInputElement).value).toBe('1')
    expect((box('A').getByLabelText('Cache breaking interruptions') as HTMLInputElement).value).toBe('6')
  })
})

describe('removing setups', () => {
  it('remove buttons appear above two setups and are named after the setup', () => {
    renderTwo()
    add()
    for (const id of ['A', 'B', 'C'] as const) expect(removeBtn(id)).toBeTruthy()
    fireEvent.click(removeBtn('C')!)
    expect(removeBtn('A')).toBeNull()
    expect(removeBtn('B')).toBeNull()
  })

  it('removing B from A, B, C leaves C with its own letter and colour variable', () => {
    renderTwo()
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
    renderTwo()
    add()
    fireEvent.click(removeBtn('B')!)
    add()
    expect(groups()).toEqual(['A', 'B', 'C'])
  })

  it('focus moves to the previous setup, or to the next when the first is removed', () => {
    renderTwo()
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

const advToggle = () => document.getElementById('advanced-toggle') as HTMLButtonElement
const advBody = () => document.getElementById('advanced-body')!
const openBodies = () => [...document.querySelectorAll<HTMLElement>('#settings-panel [id$="-body"]')].filter((b) => !b.hidden).map((b) => b.id)

describe('the settings panel is an accordion', () => {
  it('starts with Setup A expanded and everything else collapsed', () => {
    renderTwo()
    expect(toggle('A').getAttribute('aria-expanded')).toBe('true')
    expect(toggle('B').getAttribute('aria-expanded')).toBe('false')
    expect(advToggle().getAttribute('aria-expanded')).toBe('false')
    expect(openBodies()).toEqual(['setup-A-body'])
  })

  it('wires every header to its body', () => {
    renderTwo()
    expect(toggle('A').getAttribute('aria-controls')).toBe('setup-A-body')
    expect(advToggle().getAttribute('aria-controls')).toBe('advanced-body')
    expect(advBody().hidden).toBe(true)
  })

  it('expanding B collapses A', () => {
    renderTwo()
    fireEvent.click(toggle('B'))
    expect(toggle('B').getAttribute('aria-expanded')).toBe('true')
    expect(toggle('A').getAttribute('aria-expanded')).toBe('false')
    expect(openBodies()).toEqual(['setup-B-body'])
  })

  it('expanding Advanced settings collapses the open setup, and the other way round', () => {
    renderTwo()
    fireEvent.click(advToggle())
    expect(advToggle().getAttribute('aria-expanded')).toBe('true')
    expect(toggle('A').getAttribute('aria-expanded')).toBe('false')
    expect(openBodies()).toEqual(['advanced-body'])
    fireEvent.click(toggle('B'))
    expect(advToggle().getAttribute('aria-expanded')).toBe('false')
    expect(openBodies()).toEqual(['setup-B-body'])
  })

  it('collapsing the open item leaves all collapsed, and one click reopens it', () => {
    renderTwo()
    fireEvent.click(toggle('A'))
    expect(openBodies()).toEqual([])
    expect(toggle('A').getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle('A'))
    expect(openBodies()).toEqual(['setup-A-body'])
  })

  it('at most one body is visible through a sequence of toggles', () => {
    renderTwo()
    add()
    for (const click of [toggle('A'), advToggle(), toggle('B'), toggle('C'), toggle('C'), advToggle(), advToggle()]) {
      fireEvent.click(click)
      expect(openBodies().length).toBeLessThanOrEqual(1)
    }
  })

  it('the summary line shows only on collapsed setups', () => {
    renderTwo()
    expect(toggle('A').querySelector('.setup-summary')).toBeNull()
    expect(toggle('B').querySelector('.setup-summary')!.textContent).toBe('Opus 5.5 · 1 hour cache · high · reasoning kept · 1 cache break')
    fireEvent.click(toggle('B'))
    expect(toggle('B').querySelector('.setup-summary')).toBeNull()
    expect(toggle('A').querySelector('.setup-summary')!.textContent).toBe('Opus 5.5 · 5 min cache · high · reasoning kept · 6 cache breaks')
    // Advanced settings has just its title.
    expect(advToggle().querySelector('.setup-summary')).toBeNull()
  })

  it('the collapsed summary follows the values and says "no cache breaks" for 0', () => {
    renderTwo()
    fireEvent.change(box('B').getByLabelText('Cache breaking interruptions'), { target: { value: '0' } })
    expect(toggle('B').querySelector('.setup-summary')!.textContent).toBe('Opus 5.5 · 1 hour cache · high · reasoning kept · no cache breaks')
  })

  it('adding a setup expands only the new one, collapsing whatever was open', () => {
    renderTwo()
    fireEvent.click(advToggle())
    add()
    expect(openBodies()).toEqual(['setup-C-body'])
    expect(advToggle().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle('C'))
  })

  it('removing the expanded setup leaves all collapsed; removing another keeps the open one', () => {
    renderTwo()
    add()
    expect(openBodies()).toEqual(['setup-C-body'])
    fireEvent.click(removeBtn('C')!)
    expect(openBodies()).toEqual([])
    add()
    fireEvent.click(toggle('A'))
    fireEvent.click(removeBtn('B')!)
    expect(openBodies()).toEqual(['setup-A-body'])
  })

  it('the toggle contains no interactive content, and the remove button sits outside it', () => {
    renderTwo()
    add()
    expect(toggle('C').querySelector('button, a, input, select')).toBeNull()
    expect(toggle('C').contains(removeBtn('C'))).toBe(false)
  })

  it('help tips are in the expanded panel item', () => {
    renderTwo()
    expect(body('A').querySelectorAll('.info-btn')).toHaveLength(6)
    fireEvent.click(advToggle())
    expect(advBody().querySelectorAll('.info-btn')).toHaveLength(10)
    expect(advBody().hidden).toBe(false)
  })
})

describe('everything follows the number of setups', () => {
  it('feeds the charts one series per setup with the right colour variable and dash', () => {
    renderTwo()
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
    renderTwo()
    add()
    expect(document.querySelector('.summary')!.getAttribute('data-count')).toBe('5')
    expect(stat('Setup C')).toEqual({ value: '$32.76', sub: 'Opus 5.5 · 1 hour cache · 1 cache break' })
    // C is a copy of B, so B and C tie for cheapest; the first of them is named.
    expect(stat('Cheapest')).toEqual({ value: 'Setup B', sub: 'saves $7.47 (19%) vs Setup A' })
    expect(stat('Compared at').value).toBe('995K tokens')
  })

  it('a changed third setup can become the cheapest', () => {
    renderTwo()
    add()
    fireEvent.change(box('C').getByLabelText('Model'), { target: { value: 'claude-haiku-5-5' } })
    expect(stat('Cheapest').value).toBe('Setup C')
    expect(stat('Cheapest').sub).toMatch(/^saves \$\d+\.\d\d \(\d+%\) vs Setup A$/)
  })

  it('the breakdown has a row per setup and a "vs cheapest" column; the steps table a column per setup', () => {
    renderTwo()
    add()
    const rows = [...document.querySelectorAll('table')[0].querySelectorAll('tbody tr')]
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.lastElementChild!.textContent)).toEqual(['+$7.47', 'cheapest', 'cheapest'])
    const heads = [...document.querySelectorAll('table')[1].querySelectorAll('thead th')].map((h) => h.textContent)
    expect(heads).toEqual(['Context', 'Setup A', 'Setup B', 'Setup C'])
    expect(document.querySelectorAll('table')[1].querySelectorAll('tbody tr:first-child td')).toHaveLength(4)
  })

  it('four setups give six summary cards', () => {
    renderTwo()
    add()
    add()
    expect(document.querySelector('.summary')!.getAttribute('data-count')).toBe('6')
    expect(document.querySelectorAll('.summary dl > .stat')).toHaveLength(6)
  })

  it('a removal after the cheapest changes: A and C only', () => {
    renderTwo()
    add()
    fireEvent.click(removeBtn('B')!)
    expect(stat('Cheapest')).toEqual({ value: 'Setup C', sub: 'saves $7.47 (19%) vs Setup A' })
    const rows = [...document.querySelectorAll('table')[0].querySelectorAll('tbody tr')]
    expect(rows.map((r) => r.firstElementChild!.textContent!.slice(0, 8))).toEqual(['Setup A:', 'Setup C:'])
  })
})

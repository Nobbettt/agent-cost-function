import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { mockMatchMedia } from './test-matchmedia'
import { stat } from './test-summary'

vi.mock('./components/CostChart', async () => ({ CostChart: (await import('./test-chart-mock')).CostChartMock }))

const renameBtn = (name: string) => screen.getByRole('button', { name: `Rename ${name}` })
const nameInput = (id: string) => screen.getByLabelText(`Name for setup ${id}`) as HTMLInputElement
const toggle = (id: string) => document.getElementById(`setup-${id}-toggle`) as HTMLButtonElement
const head = (id: string) => document.querySelector(`.setup[data-id="${id}"] .setup-head`)!
const type = (id: string, value: string) => fireEvent.change(nameInput(id), { target: { value } })
const rename = (from: string, id: string, value: string) => {
  fireEvent.click(renameBtn(from))
  type(id, value)
  fireEvent.keyDown(nameInput(id), { key: 'Enter' })
}

beforeEach(() => mockMatchMedia(true))
afterEach(() => vi.restoreAllMocks())

describe('renaming a setup: the edit button', () => {
  it('sits between the toggle and the remove button, outside the toggle, with its own label and a decorative icon', () => {
    render(<App />)
    const btn = renameBtn('Setup B')
    expect([...head('B').children].map((c) => c.className)).toEqual(['setup-toggle', 'setup-rename', 'setup-remove'])
    expect(toggle('B').contains(btn)).toBe(false)
    expect(btn.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
    expect(btn.tabIndex).toBe(0)
  })

  it('is hidden from the visible page by CSS only (still reachable), so there is no inline style hiding it', () => {
    render(<App />)
    expect(renameBtn('Setup A').hasAttribute('hidden')).toBe(false)
    expect(renameBtn('Setup A').getAttribute('style')).toBeNull()
  })
})

describe('renaming a setup: editing', () => {
  it('clicking it turns the title into a focused input with the text selected; the chevron and key stay, the buttons go', () => {
    render(<App />)
    fireEvent.click(renameBtn('Setup B'))
    const input = nameInput('B')
    expect(input.value).toBe('Setup B')
    expect(input.maxLength).toBe(40)
    expect(document.activeElement).toBe(input)
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 7])
    const editing = head('B').firstElementChild!
    expect(editing.querySelector('.chevron')).toBeTruthy()
    expect(editing.querySelector('.key')).toBeTruthy()
    expect(editing.tagName).toBe('DIV')
    expect(screen.queryByRole('button', { name: 'Rename Setup B' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove Setup B' })).toBeNull()
    expect(document.getElementById('setup-B-toggle')).toBeNull()
  })

  it('does not touch the accordion', () => {
    render(<App />)
    expect(toggle('B').getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(renameBtn('Setup B'))
    type('B', 'Fast cache')
    fireEvent.keyDown(nameInput('B'), { key: 'Enter' })
    expect(toggle('A').getAttribute('aria-expanded')).toBe('true')
    expect(toggle('B').getAttribute('aria-expanded')).toBe('false')
  })

  it('Enter commits, shows the name in the header, and puts focus on the edit button', () => {
    render(<App />)
    rename('Setup B', 'B', '  Fast   cache ')
    expect(screen.queryByLabelText('Name for setup B')).toBeNull()
    expect(document.getElementById('setup-B-title')!.textContent).toBe('Fast cache')
    expect(document.activeElement).toBe(renameBtn('Fast cache'))
  })

  it('blur commits', () => {
    render(<App />)
    fireEvent.click(renameBtn('Setup B'))
    type('B', 'Blurred')
    fireEvent.blur(nameInput('B'))
    expect(document.getElementById('setup-B-title')!.textContent).toBe('Blurred')
    expect(document.activeElement).toBe(renameBtn('Blurred'))
  })

  it('blur to another control commits without pulling focus back', () => {
    render(<App />)
    fireEvent.click(renameBtn('Setup B'))
    type('B', 'Moved on')
    const other = toggle('A')
    other.focus()
    fireEvent.blur(nameInput('B'), { relatedTarget: other })
    expect(document.getElementById('setup-B-title')!.textContent).toBe('Moved on')
    expect(document.activeElement).toBe(other)
  })

  it('Esc cancels and restores the old name, with focus back on the edit button', () => {
    render(<App />)
    rename('Setup B', 'B', 'Kept')
    fireEvent.click(renameBtn('Kept'))
    type('B', 'Thrown away')
    fireEvent.keyDown(nameInput('B'), { key: 'Escape' })
    expect(document.getElementById('setup-B-title')!.textContent).toBe('Kept')
    expect(document.activeElement).toBe(renameBtn('Kept'))
  })

  it('an empty or default-named value reverts to "Setup X"', () => {
    render(<App />)
    rename('Setup B', 'B', 'Custom')
    rename('Custom', 'B', '   ')
    expect(document.getElementById('setup-B-title')!.textContent).toBe('Setup B')
    rename('Setup B', 'B', 'Custom')
    rename('Custom', 'B', 'Setup B')
    expect(document.getElementById('setup-B-title')!.textContent).toBe('Setup B')
    expect(new URLSearchParams(window.location.search).has('nb')).toBe(false)
  })

  it('cleans what is typed: control characters out, cut at 40', () => {
    render(<App />)
    rename('Setup B', 'B', `${'y'.repeat(50)}\u0007`)
    expect(document.getElementById('setup-B-title')!.textContent).toBe('y'.repeat(40))
  })

  it('Esc in the drawer cancels the edit and leaves the drawer open; a second Esc closes it', () => {
    mockMatchMedia(false)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Show settings' }))
    fireEvent.click(renameBtn('Setup B'))
    type('B', 'Nope')
    fireEvent.keyDown(nameInput('B'), { key: 'Escape' })
    expect(screen.queryByLabelText('Name for setup B')).toBeNull()
    expect(screen.getByRole('button', { name: 'Hide settings' })).toBeTruthy()
    expect(document.getElementById('setup-B-title')!.textContent).toBe('Setup B')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Show settings' })).toBeTruthy()
  })

  it('renaming works in the drawer and the new name sticks after it closes', () => {
    mockMatchMedia(false)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Show settings' }))
    rename('Setup B', 'B', 'Drawer name')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(stat('Drawer name').sub).toContain('1 hour cache')
  })

  it('names are text, never markup', () => {
    render(<App />)
    rename('Setup B', 'B', '<img src=x onerror=alert(1)>')
    expect(document.querySelector('img')).toBeNull()
    expect(document.getElementById('setup-B-title')!.textContent).toBe('<img src=x onerror=alert(1)>')
  })

  it('a rename keeps the setup values and the other setups untouched', () => {
    render(<App />)
    const before = stat('Setup B').value
    rename('Setup B', 'B', 'Fast cache')
    expect(stat('Fast cache').value).toBe(before)
    expect(stat('Setup A').value).toBe('$42.55')
  })
})

describe('renaming a setup: the name is used everywhere', () => {
  it('shows in the stat card, Cheapest card, breakdown, steps header, chart series, and aria labels', () => {
    render(<App />)
    rename('Setup B', 'B', 'Fast cache')
    expect(stat('Fast cache').sub).toBe('Claude Opus 5.5 · 1 hour cache')
    expect(screen.queryByText('Setup B', { selector: '.summary dt' })).toBeNull()
    expect(stat('Cheapest')).toMatchObject({ value: 'Setup C' })
    expect(stat('Cheapest').sub).toBe('saves $29.99 (54%) vs Fast cache')
    expect(screen.getByText('Fast cache: Claude Opus 5.5, 1h, high, reasoning kept')).toBeTruthy()
    const steps = [...document.querySelectorAll('details table th')].map((th) => th.textContent)
    expect(steps).toEqual(['Context', 'Setup A', 'Fast cache', 'Setup C'])
    expect(screen.getByTestId('chart-cum').getAttribute('data-names')).toBe('Setup A|Fast cache|Setup C')
    expect(screen.getByTestId('chart-req').getAttribute('data-names')).toBe('Setup A|Fast cache|Setup C')
    expect(screen.getByRole('button', { name: 'Remove Fast cache' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Fast cache' })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Provider for Fast cache', hidden: true })).toBeTruthy()
  })

  it('the cheapest card shows a custom name too', () => {
    render(<App />)
    rename('Setup C', 'C', 'Cheapo')
    expect(stat('Cheapest').value).toBe('Cheapo')
  })

  it('colour and dash still follow the id, not the name', () => {
    render(<App />)
    rename('Setup B', 'B', 'Zed')
    rename('Setup A', 'A', 'Aaa')
    const chart = screen.getByTestId('chart-cum')
    expect(chart.getAttribute('data-ids')).toBe('A,B,C')
    expect(chart.getAttribute('data-vars')).toBe('--series-a,--series-b,--series-c')
    expect(chart.getAttribute('data-dashes')).toBe('solid,solid,6 3')
  })

  it('a setup added after a rename starts as "Setup X"', () => {
    render(<App />)
    rename('Setup C', 'C', 'Named C')
    fireEvent.click(screen.getByRole('button', { name: '+ Add setup' }))
    expect(screen.getByRole('group', { name: 'Setup D' })).toBeTruthy()
    expect(within(screen.getByRole('group', { name: 'Named C' })).getByRole('button', { name: 'Rename Named C' })).toBeTruthy()
  })

  it('shows in the address bar link and loads back from it', () => {
    vi.useFakeTimers()
    window.history.replaceState(null, '', '/')
    const { unmount } = render(<App />)
    rename('Setup B', 'B', 'Fast, cache & co \u{1F680}')
    vi.advanceTimersByTime(300)
    expect(new URLSearchParams(window.location.search).get('nb')).toBe('Fast, cache & co \u{1F680}')
    unmount()
    vi.useRealTimers()
    render(<App />)
    expect(stat('Fast, cache & co \u{1F680}').sub).toContain('1 hour cache')
    window.history.replaceState(null, '', '/')
  })
})

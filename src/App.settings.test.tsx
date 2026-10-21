import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { DOCKED_STORAGE_KEY } from './hooks/useSettingsPanel'
import { stat } from './test-summary'
import { mockMatchMedia } from './test-matchmedia'

vi.mock('./components/CostChart', async () => ({ CostChart: (await import('./test-chart-mock')).CostChartMock }))

const panel = () => document.getElementById('settings-panel')!
const body = () => document.getElementById('settings-content')!
const show = () => screen.getByRole('button', { name: 'Show settings' })
const hide = () => screen.getByRole('button', { name: 'Hide settings' })
const backdrop = () => screen.queryByTestId('settings-backdrop')
const expanded = () => panel().getAttribute('data-state') === 'expanded'
const state = () => document.querySelector('.layout')!.getAttribute('data-open')

describe('settings panel: structure', () => {
  it('has the header title Settings with the hide arrow when expanded, and the body visible', () => {
    mockMatchMedia(true)
    render(<App />)
    const head = panel().querySelector('.settings-head')!
    expect(within(head as HTMLElement).getByRole('heading', { name: 'Settings' })).toBeTruthy()
    expect(hide().getAttribute('aria-expanded')).toBe('true')
    expect(hide().getAttribute('aria-controls')).toBe('settings-content')
    expect(hide().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(body().hasAttribute('hidden')).toBe(false)
    expect(screen.queryByRole('button', { name: 'Show settings' })).toBeNull()
    expect(panel().getAttribute('aria-label')).toBe('Settings')
  })

  it('collapsed it is only the rail button with a decorative vertical label; the body is hidden', () => {
    localStorage.setItem(DOCKED_STORAGE_KEY, 'false')
    mockMatchMedia(true)
    render(<App />)
    expect(show().getAttribute('aria-expanded')).toBe('false')
    expect(show().getAttribute('aria-controls')).toBe('settings-content')
    expect(show().querySelector('.settings-rail-label')!.getAttribute('aria-hidden')).toBe('true')
    expect(show().querySelector('.settings-rail-label')!.textContent).toBe('Settings')
    expect(panel().querySelector('.settings-head')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hide settings' })).toBeNull()
    expect(body().hasAttribute('hidden')).toBe(true)
    expect(panel().querySelectorAll('button:not([hidden] *)')).toHaveLength(1)
  })

  it('the navbar has no Settings button', () => {
    for (const docked of [true, false]) {
      mockMatchMedia(docked)
      const { unmount } = render(<App />)
      expect(within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('button', { name: /settings/i })).toBeNull()
      unmount()
    }
  })
})

describe('settings panel: drawer mode (below 1024px)', () => {
  it('starts closed as the rail: no backdrop, body hidden', () => {
    mockMatchMedia(false)
    render(<App />)
    expect(show().getAttribute('aria-expanded')).toBe('false')
    expect(expanded()).toBe(false)
    expect(body().hasAttribute('hidden')).toBe(true)
    expect(backdrop()).toBeNull()
    expect(state()).toBe('false')
  })

  it('opening from the rail moves focus into the drawer and shows the backdrop', () => {
    mockMatchMedia(false)
    render(<App />)
    fireEvent.click(show())
    expect(hide().getAttribute('aria-expanded')).toBe('true')
    expect(expanded()).toBe(true)
    expect(body().hasAttribute('hidden')).toBe(false)
    expect(panel().contains(document.activeElement)).toBe(true)
    expect(backdrop()).toBeTruthy()
  })

  it('opening focuses the Advanced settings header without popping a help tip, and Esc still closes the drawer', () => {
    mockMatchMedia(false)
    render(<App />)
    fireEvent.click(show())
    expect(document.activeElement).toBe(document.getElementById('advanced-toggle'))
    expect(document.querySelectorAll('.info-bubble.is-open')).toHaveLength(0)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(expanded()).toBe(false)
    expect(document.activeElement).toBe(show())
  })

  it('the header arrow closes it and returns focus to the rail', () => {
    mockMatchMedia(false)
    render(<App />)
    fireEvent.click(show())
    fireEvent.click(hide())
    expect(expanded()).toBe(false)
    expect(document.activeElement).toBe(show())
    expect(backdrop()).toBeNull()
  })

  it('Esc closes it and returns focus to the rail', () => {
    mockMatchMedia(false)
    render(<App />)
    fireEvent.click(show())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(show().getAttribute('aria-expanded')).toBe('false')
    expect(body().hasAttribute('hidden')).toBe(true)
    expect(document.activeElement).toBe(show())
    expect(backdrop()).toBeNull()
  })

  it('clicking the backdrop closes it and returns focus to the rail', () => {
    mockMatchMedia(false)
    render(<App />)
    fireEvent.click(show())
    fireEvent.click(backdrop()!)
    expect(expanded()).toBe(false)
    expect(document.activeElement).toBe(show())
  })

  it('other keys leave it open, and Esc does nothing while closed', () => {
    mockMatchMedia(false)
    render(<App />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(expanded()).toBe(false)
    fireEvent.click(show())
    fireEvent.keyDown(document, { key: 'a' })
    expect(expanded()).toBe(true)
  })

  it('always starts closed, even with a stale open value in storage, and nothing is stored', () => {
    localStorage.setItem('acf.settings.drawer', 'true')
    mockMatchMedia(false)
    render(<App />)
    expect(expanded()).toBe(false)
    expect(document.activeElement).toBe(document.querySelector('.content'))  // the scroll region, not a control
    fireEvent.click(show())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(localStorage.getItem('acf.settings.drawer')).toBe('true')
    expect(localStorage.getItem(DOCKED_STORAGE_KEY)).toBeNull()
  })

  it('keeps the settings usable inside the drawer', () => {
    mockMatchMedia(false)
    render(<App />)
    fireEvent.click(show())
    fireEvent.click(within(panel()).getAllByLabelText('OpenAI')[0])
    expect(stat('Setup A').value).not.toBe('$42.55')
  })
})

describe('settings panel: docked mode (1024px and up)', () => {
  it('starts expanded; the header arrow collapses it to the rail and the rail expands it', () => {
    mockMatchMedia(true)
    render(<App />)
    expect(expanded()).toBe(true)
    expect(backdrop()).toBeNull()
    fireEvent.click(hide())
    expect(expanded()).toBe(false)
    expect(body().hasAttribute('hidden')).toBe(true)
    expect(state()).toBe('false')
    fireEvent.click(show())
    expect(expanded()).toBe(true)
    expect(body().hasAttribute('hidden')).toBe(false)
    expect(state()).toBe('true')
  })

  it('focus follows the control that replaces the clicked one', () => {
    mockMatchMedia(true)
    render(<App />)
    hide().focus()
    fireEvent.click(hide())
    expect(document.activeElement).toBe(show())
    fireEvent.click(show())
    expect(document.activeElement).toBe(hide())
  })

  it('Esc does not close a docked sidebar', () => {
    mockMatchMedia(true)
    render(<App />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(expanded()).toBe(true)
  })

  it('remembers the choice: collapsed state is stored and restored', () => {
    mockMatchMedia(true)
    const { unmount } = render(<App />)
    fireEvent.click(hide())
    expect(localStorage.getItem(DOCKED_STORAGE_KEY)).toBe('false')
    unmount()
    render(<App />)
    expect(expanded()).toBe(false)
  })

  it('respects a remembered closed state', () => {
    localStorage.setItem(DOCKED_STORAGE_KEY, 'false')
    mockMatchMedia(true)
    render(<App />)
    expect(show().getAttribute('aria-expanded')).toBe('false')
  })

  it('works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    mockMatchMedia(true)
    render(<App />)
    expect(expanded()).toBe(true)
    fireEvent.click(hide())
    expect(expanded()).toBe(false)
  })

  it('switches mode when the media query flips, without moving focus', () => {
    const media = mockMatchMedia(true)
    render(<App />)
    expect(expanded()).toBe(true)
    act(() => media.set(false))
    expect(expanded()).toBe(false)
    expect(document.activeElement).toBe(document.querySelector('.content'))  // the scroll region, not a control
    act(() => media.set(true))
    expect(expanded()).toBe(true)
  })
})

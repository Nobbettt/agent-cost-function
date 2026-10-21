import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { DOCKED_STORAGE_KEY } from './hooks/useSettingsPanel'
import { mockMatchMedia } from './test-matchmedia'

vi.mock('./components/CostChart', () => ({ CostChart: () => null }))

const panel = () => document.getElementById('settings-panel')!
const toggle = () => screen.getByRole('button', { name: 'Settings' })
const backdrop = () => screen.queryByTestId('settings-backdrop')
const isInert = () => panel().hasAttribute('inert')

describe('settings panel: drawer mode (below 1024px)', () => {
  it('starts closed: toggle collapsed, panel inert, no backdrop', () => {
    mockMatchMedia(false)
    render(<App />)
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(isInert()).toBe(true)
    expect(backdrop()).toBeNull()
    expect(document.querySelector('.layout')!.getAttribute('data-open')).toBe('false')
  })

  it('opening moves focus into the drawer and shows the backdrop', () => {
    mockMatchMedia(false)
    render(<App />)
    fireEvent.click(toggle())
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    expect(isInert()).toBe(false)
    expect(panel().contains(document.activeElement)).toBe(true)
    expect(backdrop()).toBeTruthy()
  })

  it('Esc closes it and returns focus to the Settings button', () => {
    mockMatchMedia(false)
    render(<App />)
    fireEvent.click(toggle())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(isInert()).toBe(true)
    expect(document.activeElement).toBe(toggle())
    expect(backdrop()).toBeNull()
  })

  it('clicking the backdrop closes it and returns focus', () => {
    mockMatchMedia(false)
    render(<App />)
    fireEvent.click(toggle())
    fireEvent.click(backdrop()!)
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle())
  })

  it('other keys leave it open, and Esc does nothing while closed', () => {
    mockMatchMedia(false)
    render(<App />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle())
    fireEvent.keyDown(document, { key: 'a' })
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
  })

  it('always starts closed, even with a stale open value in storage, and nothing is stored', () => {
    localStorage.setItem('acf.settings.drawer', 'true')
    mockMatchMedia(false)
    render(<App />)
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(isInert()).toBe(true)
    expect(document.activeElement).toBe(document.body)
    fireEvent.click(toggle())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(localStorage.getItem('acf.settings.drawer')).toBe('true')
    expect(localStorage.getItem(DOCKED_STORAGE_KEY)).toBeNull()
  })

  it('keeps the settings usable inside the drawer', () => {
    mockMatchMedia(false)
    render(<App />)
    fireEvent.click(toggle())
    fireEvent.click(within(panel()).getAllByLabelText('OpenAI')[0])
    expect(document.getElementById('headline')!.textContent).not.toContain('A $42.55')
  })
})

describe('settings panel: docked mode (1024px and up)', () => {
  it('starts open and the toggle hides and shows it', () => {
    mockMatchMedia(true)
    render(<App />)
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    expect(isInert()).toBe(false)
    expect(backdrop()).toBeNull()
    fireEvent.click(toggle())
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(isInert()).toBe(true)
    expect(document.querySelector('.layout')!.getAttribute('data-open')).toBe('false')
    fireEvent.click(toggle())
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    expect(isInert()).toBe(false)
  })

  it('does not move focus when toggled', () => {
    mockMatchMedia(true)
    render(<App />)
    toggle().focus()
    fireEvent.click(toggle())
    fireEvent.click(toggle())
    expect(document.activeElement).toBe(toggle())
  })

  it('Esc does not close a docked sidebar', () => {
    mockMatchMedia(true)
    render(<App />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
  })

  it('respects a remembered closed state', () => {
    localStorage.setItem(DOCKED_STORAGE_KEY, 'false')
    mockMatchMedia(true)
    render(<App />)
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
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
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle())
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
  })

  it('switches mode when the media query flips, without moving focus', () => {
    const media = mockMatchMedia(true)
    render(<App />)
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    act(() => media.set(false))
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(document.body)
    act(() => media.set(true))
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
  })
})

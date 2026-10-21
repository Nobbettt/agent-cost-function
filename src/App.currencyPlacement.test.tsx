import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { NAV_WIDE_QUERY } from './data/breakpoints'
import { stat } from './test-summary'
import { mockMatchMedia } from './test-matchmedia'

vi.mock('./components/CostChart', async () => ({ CostChart: (await import('./test-chart-mock')).CostChartMock }))

const nav = () => within(screen.getByRole('navigation', { name: 'Main' }))
const panel = () => document.getElementById('settings-panel')!
const body = { amount: 1, base: 'USD', date: '2026-10-21', rates: { EUR: 0.9, SEK: 10 } }

describe('the currency select moves with the width', () => {
  it('from 768px up it is in the navbar and not in the settings panel', () => {
    mockMatchMedia(true)
    render(<App />)
    expect(nav().getByLabelText('Currency')).toBeTruthy()
    expect(within(panel()).queryByLabelText('Currency')).toBeNull()
    expect(screen.getAllByLabelText('Currency')).toHaveLength(1)
  })

  it('below 768px it is the first item of the settings panel and not in the navbar', () => {
    mockMatchMedia(false)
    render(<App />)
    expect(nav().queryByLabelText('Currency')).toBeNull()
    const field = within(panel()).getByLabelText('Currency') as HTMLSelectElement
    expect(screen.getAllByLabelText('Currency')).toHaveLength(1)
    expect(panel().firstElementChild!.contains(field)).toBe(true)
    // Above Advanced settings, outside the accordion, with its own help tip.
    expect(panel().firstElementChild!.compareDocumentPosition(document.getElementById('advanced')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(panel().firstElementChild!.closest('.setup')).toBeNull()
    expect(within(panel()).getByRole('button', { name: 'About Currency', hidden: true })).toBeTruthy()
    expect(field.value).toBe('USD')
  })

  it('decides with the shared compact-navbar query, 768px', () => {
    expect(NAV_WIDE_QUERY).toBe('(min-width: 768px)')
    const asked: string[] = []
    vi.stubGlobal('matchMedia', (q: string) => {
      asked.push(q)
      return { matches: true, addEventListener: () => {}, removeEventListener: () => {} }
    })
    render(<App />)
    expect(asked).toContain(NAV_WIDE_QUERY)
  })

  it('the navbar keeps Share and Settings below 768px', () => {
    mockMatchMedia(false)
    render(<App />)
    expect(nav().getByRole('button', { name: 'Share link' })).toBeTruthy()
    expect(nav().getByRole('button', { name: 'Settings' })).toBeTruthy()
  })

  it('changing it in the drawer converts the cards as before', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body })))
    mockMatchMedia(false)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.change(within(panel()).getByLabelText('Currency'), { target: { value: 'SEK' } })
    await screen.findByText(/Shown in SEK/)
    expect(stat('Setup A').value.replace(/\s/g, ' ')).toBe('SEK 426')
    expect((within(panel()).getByLabelText('Currency') as HTMLSelectElement).value).toBe('SEK')
    expect(localStorage.getItem('acf.currency')).toBe('SEK')
  })

  it('opening the drawer still focuses the first accordion header, not the currency select', () => {
    mockMatchMedia(false)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(document.activeElement).toBe(document.getElementById('advanced-toggle'))
  })
})

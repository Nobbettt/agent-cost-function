import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { CUM_SCALE_STORAGE_KEY, REQ_SCALE_STORAGE_KEY } from './hooks/useChartScale'
import { mockMatchMedia } from './test-matchmedia'

vi.mock('./components/CostChart', async () => ({ CostChart: (await import('./test-chart-mock')).CostChartMock }))

const CUM = 'Cumulative chart y axis scale'
const REQ = 'Per-request chart y axis scale'
const group = (name: string) => screen.getByRole('radiogroup', { name })
const option = (name: string, label: string) => within(group(name)).getByLabelText(label) as HTMLInputElement
const scaleOf = (metric: 'cum' | 'req') => screen.getByTestId(`chart-${metric}`).getAttribute('data-scale')

beforeEach(() => mockMatchMedia(true))

describe('the y scale switches', () => {
  it('there is one in each chart card header, right of the title, with distinct names and radio names', () => {
    render(<App />)
    for (const [name, title] of [[CUM, 'Cumulative cost vs context size'], [REQ, 'Cost per request vs context size']] as const) {
      const head = group(name).closest('.card-head') as HTMLElement
      expect(within(head).getByRole('heading', { name: title })).toBeTruthy()
      expect(head.lastElementChild).toBe(group(name))
      expect([...group(name).querySelectorAll('label')].map((l) => l.textContent)).toEqual(['Linear', 'Log'])
    }
    expect(screen.getAllByRole('radiogroup', { name: /y axis scale/ })).toHaveLength(2)
    expect(screen.queryByRole('radiogroup', { name: 'Y axis scale' })).toBeNull()
    expect(option(CUM, 'Linear').name).not.toBe(option(REQ, 'Linear').name)
    expect(option(CUM, 'Linear').name).toBe(option(CUM, 'Log').name)
  })

  it('the cumulative chart defaults to linear and the per-request chart to log', () => {
    render(<App />)
    expect(option(CUM, 'Linear').checked).toBe(true)
    expect(option(REQ, 'Log').checked).toBe(true)
    expect(scaleOf('cum')).toBe('linear')
    expect(scaleOf('req')).toBe('log')
  })

  it('each chart switches on its own and remembers its own choice', () => {
    render(<App />)
    fireEvent.click(option(CUM, 'Log'))
    expect([scaleOf('cum'), scaleOf('req')]).toEqual(['log', 'log'])
    expect(localStorage.getItem(CUM_SCALE_STORAGE_KEY)).toBe('log')
    expect(localStorage.getItem(REQ_SCALE_STORAGE_KEY)).toBeNull()
    fireEvent.click(option(REQ, 'Linear'))
    expect([scaleOf('cum'), scaleOf('req')]).toEqual(['log', 'linear'])
    expect(localStorage.getItem(REQ_SCALE_STORAGE_KEY)).toBe('linear')
    expect(option(CUM, 'Log').checked).toBe(true)
    expect(option(REQ, 'Linear').checked).toBe(true)
    fireEvent.click(option(CUM, 'Linear'))
    expect([scaleOf('cum'), scaleOf('req')]).toEqual(['linear', 'linear'])
    expect(localStorage.getItem(REQ_SCALE_STORAGE_KEY)).toBe('linear')
  })

  it('starts on the stored choices, the old acf.reqScale key included, independently', () => {
    localStorage.setItem(REQ_SCALE_STORAGE_KEY, 'linear')
    const { unmount } = render(<App />)
    expect([scaleOf('cum'), scaleOf('req')]).toEqual(['linear', 'linear'])
    unmount()
    localStorage.setItem(CUM_SCALE_STORAGE_KEY, 'log')
    localStorage.removeItem(REQ_SCALE_STORAGE_KEY)
    render(<App />)
    expect([scaleOf('cum'), scaleOf('req')]).toEqual(['log', 'log'])
  })

  it('ignores invalid stored values on both', () => {
    localStorage.setItem(REQ_SCALE_STORAGE_KEY, 'sideways')
    localStorage.setItem(CUM_SCALE_STORAGE_KEY, 'sideways')
    render(<App />)
    expect([scaleOf('cum'), scaleOf('req')]).toEqual(['linear', 'log'])
  })

  it('is a view preference: not in the share link', () => {
    vi.useFakeTimers()
    window.history.replaceState(null, '', '/')
    render(<App />)
    fireEvent.click(option(REQ, 'Linear'))
    fireEvent.click(option(CUM, 'Log'))
    fireEvent.change(screen.getByLabelText('Added per request (K tokens)'), { target: { value: '7' } })
    vi.advanceTimersByTime(300)
    expect(window.location.search).not.toBe('')
    expect(window.location.search).not.toMatch(/scale|linear|log/i)
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })
})

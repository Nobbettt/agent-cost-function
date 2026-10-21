import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { REQ_SCALE_STORAGE_KEY } from './hooks/useReqScale'
import { mockMatchMedia } from './test-matchmedia'

vi.mock('./components/CostChart', async () => ({ CostChart: (await import('./test-chart-mock')).CostChartMock }))

const group = () => screen.getByRole('radiogroup', { name: 'Y axis scale' })
const option = (name: string) => within(group()).getByLabelText(name) as HTMLInputElement
const scaleOf = (metric: 'cum' | 'req') => screen.getByTestId(`chart-${metric}`).getAttribute('data-scale')

beforeEach(() => mockMatchMedia(true))

describe('the per-request chart scale switch', () => {
  it('sits in the card header next to the title, with Linear and Log, and Log is selected by default', () => {
    render(<App />)
    const head = group().closest('.card-head') as HTMLElement
    expect(within(head).getByRole('heading', { name: 'Cost per request vs context size' })).toBeTruthy()
    expect(head.lastElementChild).toBe(group())
    expect([...group().querySelectorAll('label')].map((l) => l.textContent)).toEqual(['Linear', 'Log'])
    expect(option('Log').checked).toBe(true)
    expect(option('Linear').checked).toBe(false)
    expect(scaleOf('req')).toBe('log')
  })

  it('the cumulative chart has no switch and is always linear', () => {
    render(<App />)
    expect(screen.getAllByRole('radiogroup', { name: 'Y axis scale' })).toHaveLength(1)
    expect(scaleOf('cum')).toBe('linear')
    fireEvent.click(option('Linear'))
    expect(scaleOf('cum')).toBe('linear')
    fireEvent.click(option('Log'))
    expect(scaleOf('cum')).toBe('linear')
  })

  it('switching passes linear, then log, and remembers the choice', () => {
    render(<App />)
    fireEvent.click(option('Linear'))
    expect(scaleOf('req')).toBe('linear')
    expect(option('Linear').checked).toBe(true)
    expect(localStorage.getItem(REQ_SCALE_STORAGE_KEY)).toBe('linear')
    fireEvent.click(option('Log'))
    expect(scaleOf('req')).toBe('log')
    expect(localStorage.getItem(REQ_SCALE_STORAGE_KEY)).toBe('log')
  })

  it('starts on a stored linear choice, and ignores an invalid stored value', () => {
    localStorage.setItem(REQ_SCALE_STORAGE_KEY, 'linear')
    const { unmount } = render(<App />)
    expect(scaleOf('req')).toBe('linear')
    unmount()
    localStorage.setItem(REQ_SCALE_STORAGE_KEY, 'sideways')
    render(<App />)
    expect(scaleOf('req')).toBe('log')
  })

  it('is a view preference: not in the share link', () => {
    vi.useFakeTimers()
    window.history.replaceState(null, '', '/')
    render(<App />)
    fireEvent.click(option('Linear'))
    fireEvent.change(screen.getByLabelText('Added per request (tokens)'), { target: { value: '7000' } })
    vi.advanceTimersByTime(300)
    expect(window.location.search).not.toBe('')
    expect(window.location.search).not.toMatch(/scale|linear|log/i)
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })
})

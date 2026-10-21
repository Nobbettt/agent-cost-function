import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildShareUrl, useShareUrlSync } from './useShareUrl'

describe('buildShareUrl', () => {
  it('is origin, path and the query when there is one', () => {
    const loc = { origin: 'https://example.com', pathname: '/' }
    expect(buildShareUrl('', loc)).toBe('https://example.com/')
    expect(buildShareUrl('v=1&a=x', loc)).toBe('https://example.com/?v=1&a=x')
  })

  it('defaults to the current location', () => {
    expect(buildShareUrl('v=1')).toBe(`${window.location.origin}${window.location.pathname}?v=1`)
  })
})

describe('useShareUrlSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('replaces the address (no new history entry) after the debounce, and not before', () => {
    const spy = vi.spyOn(window.history, 'replaceState')
    const length = window.history.length
    renderHook(() => useShareUrlSync('v=1&a=x'))
    vi.advanceTimersByTime(249)
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(window.location.search).toBe('?v=1&a=x')
    expect(window.history.length).toBe(length)
  })

  it('debounces bursts: only the last query is written', () => {
    const spy = vi.spyOn(window.history, 'replaceState')
    const { rerender } = renderHook(({ q }) => useShareUrlSync(q), { initialProps: { q: 'v=1&a=1' } })
    vi.advanceTimersByTime(100)
    rerender({ q: 'v=1&a=2' })
    vi.advanceTimersByTime(100)
    rerender({ q: 'v=1&a=3' })
    vi.advanceTimersByTime(250)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(window.location.search).toBe('?v=1&a=3')
  })

  it('an empty query leaves a clean path, and does nothing when the address already matches', () => {
    const spy = vi.spyOn(window.history, 'replaceState')
    renderHook(() => useShareUrlSync(''))
    vi.advanceTimersByTime(300)
    expect(spy).not.toHaveBeenCalled()
    window.history.replaceState(null, '', '/?v=1&a=x')
    spy.mockClear()
    renderHook(() => useShareUrlSync(''))
    vi.advanceTimersByTime(300)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(window.location.search).toBe('')
    expect(window.location.pathname).toBe('/')
  })

  it('keeps the hash and cancels the timer on unmount', () => {
    window.history.replaceState(null, '', '/#top')
    const spy = vi.spyOn(window.history, 'replaceState')
    const { unmount } = renderHook(() => useShareUrlSync('v=1&a=x'))
    unmount()
    vi.advanceTimersByTime(300)
    expect(spy).not.toHaveBeenCalled()
    renderHook(() => useShareUrlSync('v=1&a=x'))
    vi.advanceTimersByTime(300)
    expect(window.location.hash).toBe('#top')
    expect(window.location.search).toBe('?v=1&a=x')
  })
})

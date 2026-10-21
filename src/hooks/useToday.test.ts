import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { todayUtc, useToday } from './useToday'

beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }))
afterEach(() => vi.useRealTimers())

describe('today in UTC', () => {
  it('is the UTC date as YYYY-MM-DD, whatever the local offset', () => {
    vi.setSystemTime(new Date('2026-12-01T23:30:00-05:00')) // 04:30 UTC on the 2nd
    expect(todayUtc()).toBe('2026-12-02')
    vi.setSystemTime(new Date('2026-12-01T00:30:00+02:00')) // 22:30 UTC on 30 November
    expect(todayUtc()).toBe('2026-11-30')
    vi.setSystemTime(new Date('2027-01-01T00:00:00Z'))
    expect(todayUtc()).toBe('2027-01-01')
  })

  it('useToday reads the date once per page load: a page left open across midnight does not switch', () => {
    vi.setSystemTime(new Date('2026-11-30T23:59:00Z'))
    const { result, rerender } = renderHook(() => useToday())
    expect(result.current).toBe('2026-11-30')
    vi.setSystemTime(new Date('2026-12-01T00:05:00Z'))
    rerender()
    expect(result.current).toBe('2026-11-30')
    expect(renderHook(() => useToday()).result.current).toBe('2026-12-01')
  })
})

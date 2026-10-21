import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CUM_SCALE_STORAGE_KEY, REQ_SCALE_STORAGE_KEY, useChartScale } from './useChartScale'

afterEach(() => vi.restoreAllMocks())

describe('useChartScale', () => {
  it('uses the given default for a missing or invalid stored value', () => {
    expect(renderHook(() => useChartScale(REQ_SCALE_STORAGE_KEY, 'log')).result.current[0]).toBe('log')
    expect(renderHook(() => useChartScale(CUM_SCALE_STORAGE_KEY, 'linear')).result.current[0]).toBe('linear')
    for (const bad of ['', 'LOG', 'logarithmic', 'null', '1']) {
      localStorage.setItem(REQ_SCALE_STORAGE_KEY, bad)
      localStorage.setItem(CUM_SCALE_STORAGE_KEY, bad)
      expect(renderHook(() => useChartScale(REQ_SCALE_STORAGE_KEY, 'log')).result.current[0]).toBe('log')
      expect(renderHook(() => useChartScale(CUM_SCALE_STORAGE_KEY, 'linear')).result.current[0]).toBe('linear')
    }
  })

  it('keeps the old per-request key: a stored choice of either kind wins over the default', () => {
    expect(REQ_SCALE_STORAGE_KEY).toBe('acf.reqScale')
    localStorage.setItem(REQ_SCALE_STORAGE_KEY, 'linear')
    expect(renderHook(() => useChartScale(REQ_SCALE_STORAGE_KEY, 'log')).result.current[0]).toBe('linear')
    localStorage.setItem(CUM_SCALE_STORAGE_KEY, 'log')
    expect(renderHook(() => useChartScale(CUM_SCALE_STORAGE_KEY, 'linear')).result.current[0]).toBe('log')
  })

  it('remembers changes under its own key only', () => {
    const { result } = renderHook(() => useChartScale(CUM_SCALE_STORAGE_KEY, 'linear'))
    act(() => result.current[1]('log'))
    expect(result.current[0]).toBe('log')
    expect(localStorage.getItem(CUM_SCALE_STORAGE_KEY)).toBe('log')
    expect(localStorage.getItem(REQ_SCALE_STORAGE_KEY)).toBeNull()
    act(() => result.current[1]('linear'))
    expect(localStorage.getItem(CUM_SCALE_STORAGE_KEY)).toBe('linear')
  })

  it('works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    const { result } = renderHook(() => useChartScale(REQ_SCALE_STORAGE_KEY, 'log'))
    expect(result.current[0]).toBe('log')
    act(() => result.current[1]('linear'))
    expect(result.current[0]).toBe('linear')
  })
})

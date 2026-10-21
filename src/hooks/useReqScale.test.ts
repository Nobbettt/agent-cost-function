import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { REQ_SCALE_STORAGE_KEY, useReqScale } from './useReqScale'

afterEach(() => vi.restoreAllMocks())

describe('useReqScale', () => {
  it('defaults to log, also for a missing or invalid stored value', () => {
    expect(renderHook(() => useReqScale()).result.current[0]).toBe('log')
    for (const bad of ['', 'LOG', 'logarithmic', 'null', '1']) {
      localStorage.setItem(REQ_SCALE_STORAGE_KEY, bad)
      expect(renderHook(() => useReqScale()).result.current[0]).toBe('log')
    }
  })

  it('reads a stored linear choice and remembers changes', () => {
    localStorage.setItem(REQ_SCALE_STORAGE_KEY, 'linear')
    const { result } = renderHook(() => useReqScale())
    expect(result.current[0]).toBe('linear')
    act(() => result.current[1]('log'))
    expect(result.current[0]).toBe('log')
    expect(localStorage.getItem(REQ_SCALE_STORAGE_KEY)).toBe('log')
    act(() => result.current[1]('linear'))
    expect(localStorage.getItem(REQ_SCALE_STORAGE_KEY)).toBe('linear')
  })

  it('works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    const { result } = renderHook(() => useReqScale())
    expect(result.current[0]).toBe('log')
    act(() => result.current[1]('linear'))
    expect(result.current[0]).toBe('linear')
  })
})

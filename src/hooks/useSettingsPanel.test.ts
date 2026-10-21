import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockMatchMedia } from '../test-matchmedia'
import { STORAGE_KEYS, useSettingsPanel } from './useSettingsPanel'

describe('useSettingsPanel', () => {
  it('is open and docked on large screens, closed and a drawer on small ones', () => {
    mockMatchMedia(true)
    expect(renderHook(() => useSettingsPanel()).result.current).toMatchObject({ mode: 'docked', open: true })
    mockMatchMedia(false)
    expect(renderHook(() => useSettingsPanel()).result.current).toMatchObject({ mode: 'drawer', open: false })
  })

  it('assumes docked where matchMedia does not exist', () => {
    expect(renderHook(() => useSettingsPanel()).result.current).toMatchObject({ mode: 'docked', open: true })
  })

  it('toggle and close change the state and remember it per mode', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useSettingsPanel())
    act(() => result.current.toggle())
    expect(result.current.open).toBe(true)
    expect(localStorage.getItem(STORAGE_KEYS.drawer)).toBe('true')
    expect(localStorage.getItem(STORAGE_KEYS.docked)).toBeNull()
    act(() => result.current.close())
    expect(result.current.open).toBe(false)
    expect(localStorage.getItem(STORAGE_KEYS.drawer)).toBe('false')
  })

  it('respects stored values', () => {
    localStorage.setItem(STORAGE_KEYS.docked, 'false')
    localStorage.setItem(STORAGE_KEYS.drawer, 'true')
    mockMatchMedia(true)
    expect(renderHook(() => useSettingsPanel()).result.current.open).toBe(false)
    mockMatchMedia(false)
    expect(renderHook(() => useSettingsPanel()).result.current.open).toBe(true)
  })

  it('ignores garbage in storage', () => {
    localStorage.setItem(STORAGE_KEYS.docked, 'maybe')
    mockMatchMedia(true)
    expect(renderHook(() => useSettingsPanel()).result.current.open).toBe(true)
  })

  it('switches to the other mode\'s own value when the breakpoint flips', () => {
    localStorage.setItem(STORAGE_KEYS.drawer, 'true')
    const media = mockMatchMedia(true)
    const { result } = renderHook(() => useSettingsPanel())
    expect(result.current).toMatchObject({ mode: 'docked', open: true })
    act(() => result.current.close())
    expect(result.current.open).toBe(false)
    act(() => media.set(false))
    expect(result.current).toMatchObject({ mode: 'drawer', open: true })
    act(() => media.set(true))
    expect(result.current).toMatchObject({ mode: 'docked', open: false })
  })

  it('works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    mockMatchMedia(false)
    const { result } = renderHook(() => useSettingsPanel())
    expect(result.current.open).toBe(false)
    act(() => result.current.toggle())
    expect(result.current.open).toBe(true)
  })
})

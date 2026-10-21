import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockMatchMedia } from '../test-matchmedia'
import { DOCKED_STORAGE_KEY, useSettingsPanel } from './useSettingsPanel'

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

  it('drawer toggle and close change the state without touching storage', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useSettingsPanel())
    act(() => result.current.toggle())
    expect(result.current.open).toBe(true)
    act(() => result.current.close())
    expect(result.current.open).toBe(false)
    expect(localStorage.length).toBe(0)
  })

  it('docked toggle remembers the choice in storage', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useSettingsPanel())
    act(() => result.current.toggle())
    expect(result.current.open).toBe(false)
    expect(localStorage.getItem(DOCKED_STORAGE_KEY)).toBe('false')
    act(() => result.current.toggle())
    expect(localStorage.getItem(DOCKED_STORAGE_KEY)).toBe('true')
  })

  it('respects the stored docked value and ignores a stale drawer value', () => {
    localStorage.setItem(DOCKED_STORAGE_KEY, 'false')
    localStorage.setItem('acf.settings.drawer', 'true')
    mockMatchMedia(true)
    expect(renderHook(() => useSettingsPanel()).result.current.open).toBe(false)
    mockMatchMedia(false)
    expect(renderHook(() => useSettingsPanel()).result.current.open).toBe(false)
  })

  it('ignores garbage in storage', () => {
    localStorage.setItem(DOCKED_STORAGE_KEY, 'maybe')
    mockMatchMedia(true)
    expect(renderHook(() => useSettingsPanel()).result.current.open).toBe(true)
  })

  it('docked keeps its remembered value across flips; the drawer is closed on every flip into drawer mode', () => {
    const media = mockMatchMedia(true)
    const { result } = renderHook(() => useSettingsPanel())
    act(() => result.current.close())
    expect(result.current).toMatchObject({ mode: 'docked', open: false })
    act(() => media.set(false))
    expect(result.current).toMatchObject({ mode: 'drawer', open: false })
    act(() => result.current.toggle())
    expect(result.current.open).toBe(true)
    act(() => media.set(true))
    expect(result.current).toMatchObject({ mode: 'docked', open: false })
    act(() => media.set(false))
    expect(result.current).toMatchObject({ mode: 'drawer', open: false })
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

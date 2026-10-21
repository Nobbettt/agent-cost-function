import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCurrency } from './context'

describe('useCurrency', () => {
  it('throws outside a CurrencyProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useCurrency())).toThrow('inside <CurrencyProvider>')
  })
})

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETUPS } from '../data/defaults'
import { formatMoney } from '../format'
import type { Comparison } from '../model/compare'
import type { CacheId, Setup } from '../model/types'
import { stat } from '../test-summary'
import { SummaryCards } from './SummaryCards'

const usd = (v: number) => formatMoney(v)
const base: Comparison = { common: 995000, a: 42.55, b: 28.92, cheaper: 'B', percent: 32, capped: false }
const setups = [DEFAULT_SETUPS.A, DEFAULT_SETUPS.B] as const
const show = (c: Partial<Comparison> = {}, s: readonly [Setup, Setup] = setups, format = usd) =>
  render(<SummaryCards comparison={{ ...base, ...c }} setups={s} format={format} />)

describe('SummaryCards', () => {
  it('shows the default numbers, with B cheaper', () => {
    show()
    expect(stat('Setup A')).toEqual({ value: '$42.55', sub: 'Claude Opus 5.5 · 5 min cache' })
    expect(stat('Setup B')).toEqual({ value: '$28.92', sub: 'Claude Opus 5.5 · 1 hour cache' })
    expect(stat('Difference (B − A)')).toEqual({ value: '−$13.63', sub: 'B is 32% cheaper' })
    expect(stat('Compared at')).toEqual({ value: '995K tokens', sub: 'context size' })
  })

  it('A cheaper gives a plus sign and "A is N% cheaper"', () => {
    show({ a: 28.92, b: 42.55, cheaper: 'A' })
    expect(stat('Difference (B − A)')).toEqual({ value: '+$13.63', sub: 'A is 32% cheaper' })
  })

  it('equal cost is $0 and "Both cost the same"', () => {
    show({ a: 10, b: 10, cheaper: null, percent: 0 })
    expect(stat('Difference (B − A)')).toEqual({ value: '$0', sub: 'Both cost the same' })
  })

  it('a capped run changes the compared-at sub-line', () => {
    show({ common: 920000, capped: true })
    expect(stat('Compared at')).toEqual({ value: '920K tokens', sub: 'One model stops earlier at its max input' })
  })

  it('formats every value through the given formatter (the display currency)', () => {
    show({}, setups, (v) => formatMoney(v, 'SEK', 10))
    expect(stat('Setup A').value).toBe('SEK 426')
    expect(stat('Difference (B − A)').value).toBe('−SEK 136')
  })

  it.each<[CacheId, string]>([['5m', '5 min'], ['1h', '1 hour'], ['30m', '30 min'], ['24h', '24h'], ['in_memory', 'in_memory']])(
    'labels the %s cache as "%s"',
    (cache, label) => {
      show({}, [{ ...DEFAULT_SETUPS.A, cache }, DEFAULT_SETUPS.B])
      expect(stat('Setup A').sub).toBe(`Claude Opus 5.5 · ${label} cache`)
    },
  )

  it('is a Summary region whose definition list holds the four cards, with series keys on A and B only', () => {
    const { container } = show()
    expect(container.querySelector('section.summary')?.getAttribute('aria-label')).toBe('Summary')
    expect(container.querySelectorAll('dl > .stat > dt')).toHaveLength(4)
    expect(container.querySelectorAll('dt .key')).toHaveLength(2)
  })
})

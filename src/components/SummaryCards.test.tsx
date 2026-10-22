import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETUPS } from '../data/defaults'
import { formatMoney } from '../format'
import type { Comparison } from '../model/compare'
import type { CacheId, Setup } from '../model/types'
import { stat } from '../test-summary'
import { SummaryCards } from './SummaryCards'

const usd = (v: number) => formatMoney(v)
const base: Comparison = {
  common: 995000,
  values: [{ id: 'A', value: 42.55 }, { id: 'B', value: 28.92 }],
  cheapest: 'B', mostExpensive: 'A', saving: 13.63, percent: 32, capped: false,
}
const setups = [DEFAULT_SETUPS.A, DEFAULT_SETUPS.B] as const
const show = (c: Partial<Comparison> = {}, s: readonly Setup[] = setups, format = usd) =>
  render(<SummaryCards comparison={{ ...base, ...c }} setups={s} format={format} />)

const C: Setup = { ...DEFAULT_SETUPS.B, id: 'C', provider: 'openai', model: 'gpt-5.6-sol', cache: '30m' }
const D: Setup = { ...DEFAULT_SETUPS.B, id: 'D', cache: '24h' }
const three: Partial<Comparison> = {
  values: [{ id: 'A', value: 42.55 }, { id: 'B', value: 28.92 }, { id: 'C', value: 60.64 }],
  cheapest: 'B', mostExpensive: 'C', saving: 31.72, percent: 52,
}

describe('SummaryCards: two setups', () => {
  it('shows each setup, the cheapest and the compared-at size', () => {
    show()
    expect(stat('Setup A')).toEqual({ value: '$42.55', sub: 'Claude Opus 5.5 · 5 min cache · 6 cache breaks' })
    expect(stat('Setup B')).toEqual({ value: '$28.92', sub: 'Claude Opus 5.5 · 1 hour cache · 1 cache break' })
    expect(stat('Cheapest')).toEqual({ value: 'Setup B', sub: 'saves $13.63 (32%) vs Setup A' })
    expect(stat('Compared at')).toEqual({ value: '995K tokens', sub: 'context size' })
  })

  it('A cheaper reads the other way round', () => {
    show({ values: [{ id: 'A', value: 28.92 }, { id: 'B', value: 42.55 }], cheapest: 'A', mostExpensive: 'B' })
    expect(stat('Cheapest')).toEqual({ value: 'Setup A', sub: 'saves $13.63 (32%) vs Setup B' })
  })

  it('equal cost says so', () => {
    show({ values: [{ id: 'A', value: 10 }, { id: 'B', value: 10 }], cheapest: null, mostExpensive: null, saving: 0, percent: 0 })
    expect(stat('Cheapest')).toEqual({ value: 'Equal', sub: 'All cost the same' })
  })

  it('a capped run changes the compared-at sub-line', () => {
    show({ common: 920000, capped: true })
    expect(stat('Compared at')).toEqual({ value: '920K tokens', sub: 'One model stops earlier at its max input' })
  })

  it('formats every value through the given formatter (the display currency)', () => {
    show({}, setups, (v) => formatMoney(v, 'SEK', 10))
    expect(stat('Setup A').value).toBe('SEK 426')
    expect(stat('Cheapest').sub.replace(/\s/g, ' ')).toBe('saves SEK 136 (32%) vs Setup A')
  })

  it.each<[CacheId, string]>([['5m', '5 min'], ['1h', '1 hour'], ['30m', '30 min'], ['24h', '24h'], ['in_memory', 'in_memory']])(
    'labels the %s cache as "%s"',
    (cache, label) => {
      show({}, [{ ...DEFAULT_SETUPS.A, cache }, DEFAULT_SETUPS.B])
      expect(stat('Setup A').sub).toBe(`Claude Opus 5.5 · ${label} cache · 6 cache breaks`)
    },
  )

  it.each<[number, string]>([[0, 'no cache breaks'], [1, '1 cache break'], [2, '2 cache breaks'], [6, '6 cache breaks'], [50, '50 cache breaks']])(
    'says "%s" interruptions as "%s" on the setup card only',
    (interruptions, words) => {
      show({}, [{ ...DEFAULT_SETUPS.A, interruptions }, DEFAULT_SETUPS.B])
      expect(stat('Setup A').sub).toBe(`Claude Opus 5.5 · 5 min cache · ${words}`)
      expect(stat('Cheapest').sub).not.toMatch(/cache break/)
      expect(stat('Compared at').sub).not.toMatch(/cache break/)
    },
  )

  it('is a Summary region with four cards (two setups, Cheapest, Compared at) and a key on each setup only', () => {
    const { container } = show()
    const section = container.querySelector('section.summary')!
    expect(section.getAttribute('aria-label')).toBe('Summary')
    expect(section.getAttribute('data-count')).toBe('4')
    expect(container.querySelectorAll('dl > .stat > dt')).toHaveLength(4)
    expect(container.querySelectorAll('dt .key')).toHaveLength(2)
  })
})

describe('SummaryCards: series tint', () => {
  it('setup cards carry their series id; Cheapest and Compared at carry none', () => {
    const { container } = show(three, [...setups, C])
    const ids = [...container.querySelectorAll('dl > .stat')].map((e) => e.getAttribute('data-series'))
    expect(ids).toEqual(['A', 'B', 'C', null, null])
  })
})

describe('SummaryCards: three and four setups', () => {
  it('three setups: one card each, Cheapest measured against the most expensive', () => {
    const { container } = show(three, [...setups, C])
    expect(container.querySelector('section.summary')!.getAttribute('data-count')).toBe('5')
    expect(stat('Setup C')).toEqual({ value: '$60.64', sub: 'GPT-5.6 Sol · 30 min cache · 1 cache break' })
    expect(stat('Cheapest')).toEqual({ value: 'Setup B', sub: 'saves $31.72 (52%) vs Setup C' })
    expect(container.querySelectorAll('dt .key')).toHaveLength(3)
  })

  it('four setups give six cards', () => {
    const { container } = show(
      { values: [...three.values!, { id: 'D', value: 50 }], cheapest: 'B', mostExpensive: 'C' },
      [...setups, C, D],
    )
    expect(container.querySelector('section.summary')!.getAttribute('data-count')).toBe('6')
    expect(container.querySelectorAll('dl > .stat')).toHaveLength(6)
    expect(stat('Setup D')).toEqual({ value: '$50.00', sub: 'Claude Opus 5.5 · 24h cache · 1 cache break' })
  })

  it('draws each setup\'s key with its own colour variable; C and D are dashed, A and B solid', () => {
    const { container } = show({ ...three }, [...setups, C])
    const lines = [...container.querySelectorAll('dt svg.key line')]
    expect(lines.map((l) => l.getAttribute('stroke'))).toEqual(['var(--series-a)', 'var(--series-b)', 'var(--series-c)'])
    expect(lines.map((l) => l.getAttribute('stroke-dasharray'))).toEqual([null, null, '6 3'])
  })

  it('a setup keeps its card after a removal: A and C show A and C', () => {
    show({ values: [{ id: 'A', value: 5 }, { id: 'C', value: 3 }], cheapest: 'C', mostExpensive: 'A', saving: 2, percent: 40 }, [DEFAULT_SETUPS.A, C])
    expect(stat('Setup C').value).toBe('$3.00')
    expect(stat('Cheapest').value).toBe('Setup C')
  })
})

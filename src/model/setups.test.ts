import { describe, expect, it } from 'vitest'
import { DEFAULT_SETUP_LIST, DEFAULT_SETUPS } from '../data/defaults'
import {
  addSetup, canAddSetup, canRemoveSetup, firstFreeId, focusAfterRemove, modelAndCache, removeSetup, summarizeSetup,
} from './setups'
import type { Setup, SetupId } from './types'

const A = DEFAULT_SETUPS.A
const B = DEFAULT_SETUPS.B
const make = (...ids: SetupId[]): Setup[] => ids.map((id) => ({ ...A, id }))
const ids = (list: readonly Setup[]) => list.map((s) => s.id)

describe('summarizeSetup', () => {
  it('summarises a Claude setup', () => {
    expect(summarizeSetup(A)).toBe('Claude Opus 5.5 · 5 min cache · high · reasoning kept · 7 × 6 min')
    expect(summarizeSetup(B)).toBe('Claude Opus 5.5 · 1 hour cache · high · reasoning kept · 7 × 6 min')
  })

  it('summarises an OpenAI setup', () => {
    const s: Setup = { id: 'C', provider: 'openai', model: 'gpt-5.6-sol', cache: '30m', effort: 'medium', reasoning: 'dropped', interruptions: 3, pause: 20 }
    expect(summarizeSetup(s)).toBe('GPT-5.6 Sol · 30 min cache · medium · reasoning dropped · 3 × 20 min')
  })

  it('says "no interruptions" for 0', () => {
    expect(summarizeSetup({ ...A, interruptions: 0, pause: 20 })).toBe('Claude Opus 5.5 · 5 min cache · high · reasoning kept · no interruptions')
  })

  it.each([['5m', '5 min'], ['1h', '1 hour'], ['30m', '30 min'], ['24h', '24h'], ['in_memory', 'in_memory']] as const)(
    'uses the short cache label for %s',
    (cache, label) => {
      expect(modelAndCache({ ...A, cache })).toBe(`Claude Opus 5.5 · ${label} cache`)
    },
  )
})

describe('adding and removing setups', () => {
  it('first free id fills the gaps in letter order', () => {
    expect(firstFreeId(make('A', 'B'))).toBe('C')
    expect(firstFreeId(make('A', 'C'))).toBe('B')
    expect(firstFreeId(make('B', 'C'))).toBe('A')
    expect(firstFreeId(make('A', 'B', 'C', 'D'))).toBeNull()
  })

  it('a new setup copies the last one with the next free id', () => {
    const list = [A, { ...B, effort: 'low' as const, interruptions: 2 }]
    const next = addSetup(list)
    expect(ids(next)).toEqual(['A', 'B', 'C'])
    expect(next[2]).toEqual({ ...list[1], id: 'C' })
    expect(next[2]).not.toBe(list[1])
  })

  it('goes up to four, and the fifth is refused', () => {
    let list: Setup[] = [...DEFAULT_SETUP_LIST]
    list = addSetup(list)
    list = addSetup(list)
    expect(ids(list)).toEqual(['A', 'B', 'C', 'D'])
    expect(canAddSetup(list)).toBe(false)
    expect(ids(addSetup(list))).toEqual(['A', 'B', 'C', 'D'])
  })

  it('reuses a freed letter and keeps the list in letter order', () => {
    const list = removeSetup(make('A', 'B', 'C'), 'B')
    expect(ids(list)).toEqual(['A', 'C'])
    const again = addSetup(list)
    expect(ids(again)).toEqual(['A', 'B', 'C'])
    // The copy is of the last setup in the list (C), whatever its letter.
    expect(again[1]).toEqual({ ...list[1], id: 'B' })
  })

  it('removing keeps the other setups\' ids, so their colours', () => {
    const list = removeSetup(make('A', 'B', 'C', 'D'), 'B')
    expect(ids(list)).toEqual(['A', 'C', 'D'])
  })

  it('removal is only possible above two setups', () => {
    expect(canRemoveSetup(make('A', 'B'))).toBe(false)
    expect(canRemoveSetup(make('A', 'B', 'C'))).toBe(true)
    expect(ids(removeSetup(make('A', 'B'), 'A'))).toEqual(['A', 'B'])
  })

  it('never mutates its input', () => {
    const list = Object.freeze(make('A', 'B', 'C')) as Setup[]
    expect(() => addSetup(list)).not.toThrow()
    expect(() => removeSetup(list, 'B')).not.toThrow()
    expect(ids(list)).toEqual(['A', 'B', 'C'])
  })

  it('addSetup on an empty list is a no-op', () => {
    expect(addSetup([])).toEqual([])
  })
})

describe('focusAfterRemove', () => {
  const list = make('A', 'B', 'C')
  it('goes to the previous setup, or the next when the first is removed', () => {
    expect(focusAfterRemove(list, 'B')).toBe('A')
    expect(focusAfterRemove(list, 'C')).toBe('B')
    expect(focusAfterRemove(list, 'A')).toBe('B')
  })

  it('is null for an unknown id or a lone setup', () => {
    expect(focusAfterRemove(list, 'D')).toBeNull()
    expect(focusAfterRemove(make('A'), 'A')).toBeNull()
  })
})

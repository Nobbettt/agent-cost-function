import { describe, expect, it } from 'vitest'
import { DEFAULT_SETUP_LIST, DEFAULT_SETUPS } from '../data/defaults'
import {
  addSetup, canAddSetup, canRemoveSetup, cleanName, displayName, firstFreeId, cacheBreaks, cardSubline, toggleExplicit, usesExplicitCache, focusAfterRemove, modelAndCache, removeSetup, summarizeSetup,
} from './setups'
import type { Setup, SetupId } from './types'

const A = DEFAULT_SETUPS.A
const B = DEFAULT_SETUPS.B
const make = (...ids: SetupId[]): Setup[] => ids.map((id) => ({ ...A, id }))
const ids = (list: readonly Setup[]) => list.map((s) => s.id)

describe('summarizeSetup', () => {
  it('summarises a Claude setup', () => {
    expect(summarizeSetup(A)).toBe('Claude Opus 5.5 · 5 min cache · high · reasoning kept · 6 cache breaks')
    expect(summarizeSetup(B)).toBe('Claude Opus 5.5 · 1 hour cache · high · reasoning kept · 1 cache break')
  })

  it('summarises an OpenAI setup', () => {
    const s: Setup = { id: 'C', provider: 'openai', model: 'gpt-5.6-sol', cache: '30m', effort: 'medium', reasoning: 'dropped', interruptions: 3 }
    expect(summarizeSetup(s)).toBe('GPT-5.6 Sol · 30 min cache · medium · reasoning dropped · 3 cache breaks')
  })

  it('says "1 cache break" for exactly one', () => {
    expect(summarizeSetup({ ...A, interruptions: 1 })).toBe('Claude Opus 5.5 · 5 min cache · high · reasoning kept · 1 cache break')
  })

  it('says "no cache breaks" for 0', () => {
    expect(summarizeSetup({ ...A, interruptions: 0 })).toBe('Claude Opus 5.5 · 5 min cache · high · reasoning kept · no cache breaks')
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

describe('displayName', () => {
  it('is the custom name, trimmed, or "Setup X" when there is none or it is blank', () => {
    expect(displayName({ id: 'B' })).toBe('Setup B')
    expect(displayName({ id: 'B', name: '  Fast cache ' })).toBe('Fast cache')
    expect(displayName({ id: 'B', name: '   ' })).toBe('Setup B')
  })

  it('a new setup copies the last one without its custom name', () => {
    const named: Setup[] = [{ ...A, id: 'A', name: 'Mine' }, { ...B, name: 'Fast cache' }]
    const next = addSetup(named)
    expect(next.map(displayName)).toEqual(['Mine', 'Fast cache', 'Setup C'])
    expect(next[2].name).toBeUndefined()
    expect(named[1].name).toBe('Fast cache')
  })
})

describe('cleanName', () => {
  it('trims and collapses whitespace runs, tabs and newlines to one space', () => {
    expect(cleanName('  Fast   cache \t\n now ', 'B')).toBe('Fast cache now')
  })

  it('strips control characters and lone surrogates', () => {
    expect(cleanName('Fa\u0000st\u0007 c\u001bache', 'B')).toBe('Fast cache')
    expect(cleanName('a\uD800b', 'B')).toBe('ab')
  })

  it('cuts at 40 and does not leave a trailing space or half an emoji', () => {
    expect(cleanName('x'.repeat(60), 'A')).toBe('x'.repeat(40))
    expect(cleanName(`${'x'.repeat(39)} yyyy`, 'A')).toBe('x'.repeat(39))
    const cut = cleanName(`${'x'.repeat(39)}\u{1F680}tail`, 'A')!
    expect(cut).toBe('x'.repeat(39))
    expect(cut).not.toMatch(/[\uD800-\uDBFF]$/)
    expect(cleanName('\u{1F680}'.repeat(30), 'A')).toBe('\u{1F680}'.repeat(20))
  })

  it('keeps emoji and other unicode', () => {
    expect(cleanName('Snabb cache \u{1F680} \u00E5\u00E4\u00F6 \u65E5\u672C', 'B')).toBe('Snabb cache \u{1F680} \u00E5\u00E4\u00F6 \u65E5\u672C')
    expect(cleanName('\u{1F468}\u200D\u{1F4BB}', 'B')).toBe('\u{1F468}\u200D\u{1F4BB}')
  })

  it('gives undefined for nothing, only whitespace or control characters, and for the default name of that setup', () => {
    for (const raw of [undefined, null, '', '   ', '\u0000\u0007', ' Setup  B '] as const) expect(cleanName(raw, 'B')).toBeUndefined()
    expect(cleanName('Setup B', 'A')).toBe('Setup B')
  })
})

describe('explicit cache in the card and the summary', () => {
  const pro: Setup = { ...A, provider: 'google', model: 'gemini-3.1-pro-preview', cache: 'implicit', effort: 'high', reasoning: 'kept', interruptions: 6 }

  it('says "implicit + explicit cache (2 h)" only while the explicit cache is on', () => {
    expect(cardSubline({ ...pro, explicitHours: 2 })).toBe('Gemini 3.1 Pro Preview · implicit + explicit cache (2 h) · 6 cache breaks')
    expect(cardSubline({ ...pro, explicitHours: 0.25 })).toContain('implicit + explicit cache (0.25 h)')
    expect(cardSubline(pro)).toBe('Gemini 3.1 Pro Preview · implicit cache · 6 cache breaks')
    expect(summarizeSetup({ ...pro, explicitHours: 2 })).toBe('Gemini 3.1 Pro Preview · implicit + explicit cache (2 h) · high · reasoning kept · 6 cache breaks')
  })

  it('ignores explicitHours on a model without the option', () => {
    expect(cardSubline({ ...pro, model: 'gemini-4-argon', explicitHours: 2 })).toBe('Gemini 4 Argon · implicit cache · 6 cache breaks')
    expect(usesExplicitCache({ model: 'claude-opus-5-5', explicitHours: 2 })).toBe(false)
    expect(usesExplicitCache({ model: 'gemini-3.8-flash', explicitHours: 2 })).toBe(true)
    expect(usesExplicitCache({ model: 'gemini-3.8-flash' })).toBe(false)
  })

  it('toggleExplicit turns it on with the default hours, keeps existing hours, and turns it off', () => {
    expect(toggleExplicit(pro, true).explicitHours).toBe(2)
    expect(toggleExplicit({ ...pro, explicitHours: 7 }, true).explicitHours).toBe(7)
    expect('explicitHours' in toggleExplicit({ ...pro, explicitHours: 7 }, false)).toBe(false)
  })
})

describe('cacheBreaks and cardSubline', () => {
  it('say "no cache breaks", "1 cache break" and "N cache breaks"', () => {
    expect(cacheBreaks({ ...A, interruptions: 0 })).toBe('no cache breaks')
    expect(cacheBreaks({ ...A, interruptions: 1 })).toBe('1 cache break')
    expect(cacheBreaks({ ...A, interruptions: 2 })).toBe('2 cache breaks')
    expect(cacheBreaks({ ...A, interruptions: 50 })).toBe('50 cache breaks')
  })

  it('build the card sub-line from the model, the cache and the breaks, and the summary uses the same wording', () => {
    expect(cardSubline(A)).toBe('Claude Opus 5.5 · 5 min cache · 6 cache breaks')
    expect(cardSubline(B)).toBe('Claude Opus 5.5 · 1 hour cache · 1 cache break')
    expect(cardSubline({ ...A, interruptions: 0 })).toBe('Claude Opus 5.5 · 5 min cache · no cache breaks')
    expect(summarizeSetup(B).endsWith(cacheBreaks(B))).toBe(true)
  })
})

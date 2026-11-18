import { describe, expect, it } from 'vitest'
import { MODELS } from './pricing'

/** USD per 1M tokens for a multiplier on the model's input price. */
const per = (id: string, mult: number) => +(MODELS[id].in * mult).toFixed(4)
const write = (id: string, cache: string) => per(id, MODELS[id].cache.find((c) => c.id === cache)!.write)

describe('models added 2026-11-18, against the docs', () => {
  it('Fable 5.2: $8 in, $40 out, $0.20 cache read, $10 5 min write, $16 1 hour write, 1M context, default effort high, thinking kept', () => {
    const m = MODELS['claude-fable-5-2']
    expect([m.in, m.out, per('claude-fable-5-2', m.read), write('claude-fable-5-2', '5m'), write('claude-fable-5-2', '1h')]).toEqual([8, 40, 0.2, 10, 16])
    expect([m.maxInput, m.defaultEffort, m.reasoning[0], m.longPrompt]).toEqual([1e6, 'high', 'kept', undefined])
  })

  it.each([
    ['gpt-6.2-astra', 8, 40, 0.4, 10],
    ['gpt-6.2-sol', 2, 10, 0.1, 2.5],
  ] as const)('%s: $%s in, $%s out, $%s cached, $%s 30 min write; 922K input; 2× in and 1.5× out above 272K', (id, input, output, cached, cacheWrite) => {
    const m = MODELS[id]
    expect([m.in, m.out, per(id, m.read), write(id, '30m')]).toEqual([input, output, cached, cacheWrite])
    expect([m.maxInput, m.longPrompt]).toEqual([922000, { above: 272000, inMult: 2, outMult: 1.5 }])
    expect(m.efforts).not.toContain('none')
    expect(m.defaultEffort).toBeNull()
  })
})

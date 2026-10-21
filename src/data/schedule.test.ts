import { describe, expect, it } from 'vitest'
import { MODELS, priceOn, upcomingChanges } from './pricing'

const price = (id: string, date?: string) => { const m = priceOn(MODELS[id], date); return [m.in, m.out, +(m.in * m.read).toFixed(6)] }

describe('scheduled price changes', () => {
  it('only Gemini 4 Argon, 3.8 Flash and 3.6 Flash have a schedule, sorted ascending', () => {
    const scheduled = Object.entries(MODELS).filter(([, m]) => m.schedule).map(([id]) => id)
    expect(scheduled).toEqual(['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.6-flash'])
    for (const id of scheduled) {
      const dates = MODELS[id].schedule!.map((c) => c.from)
      expect(dates).toEqual([...dates].sort())
    }
    expect(MODELS['gemini-4-argon'].schedule).toEqual([{ from: '2026-12-01', in: 4, out: 20 }])
    expect(MODELS['gemini-3.8-flash'].schedule).toEqual([{ from: '2027-01-01', in: 1.5, out: 7.5 }])
    expect(MODELS['gemini-3.6-flash'].schedule).toEqual([{ from: '2027-01-01', in: 1.5, out: 7.5 }])
  })

  it('priceOn: Gemini 4 Argon is $2 / $0.10 / $10 before 2026-12-01 and $4 / $0.20 / $20 from that day on', () => {
    expect(price('gemini-4-argon', '2026-11-30')).toEqual([2, 10, 0.1])
    expect(price('gemini-4-argon', '2026-12-01')).toEqual([4, 20, 0.2])
    expect(price('gemini-4-argon', '2026-12-02')).toEqual([4, 20, 0.2])
    expect(price('gemini-4-argon', '2027-01-01')).toEqual([4, 20, 0.2])
    expect(price('gemini-4-argon', '2026-10-21')).toEqual([2, 10, 0.1])
  })

  it('priceOn: the Flash models are $0.75 / $0.075 / $3.75 until 2026-12-31 and $1.50 / $0.15 / $7.50 from 2027-01-01', () => {
    for (const id of ['gemini-3.8-flash', 'gemini-3.6-flash']) {
      expect(price(id, '2026-11-30')).toEqual([0.75, 3.75, 0.075])
      expect(price(id, '2026-12-01')).toEqual([0.75, 3.75, 0.075])
      expect(price(id, '2026-12-31')).toEqual([0.75, 3.75, 0.075])
      expect(price(id, '2027-01-01')).toEqual([1.5, 7.5, 0.15])
      expect(price(id, '2030-06-15')).toEqual([1.5, 7.5, 0.15])
    }
  })

  it('priceOn keeps the read multiplier when a change gives none, and the limits and long-prompt rule always', () => {
    const after = priceOn(MODELS['gemini-4-argon'], '2026-12-01')
    expect(after.read).toBe(0.05)
    expect(after.maxInput).toBe(MODELS['gemini-4-argon'].maxInput)
    expect(after.cache).toBe(MODELS['gemini-4-argon'].cache)
    expect(priceOn({ ...MODELS['gemini-3.1-pro-preview'], schedule: [{ from: '2027-01-01', in: 3, out: 15, read: 0.2 }] }, '2027-01-01'))
      .toMatchObject({ in: 3, out: 15, read: 0.2, longPrompt: { above: 200000, inMult: 2, outMult: 1.5 } })
  })

  it('priceOn does not change the model it is given, and gives the base prices without a date', () => {
    const before = JSON.stringify(MODELS['gemini-4-argon'])
    priceOn(MODELS['gemini-4-argon'], '2027-01-01')
    expect(JSON.stringify(MODELS['gemini-4-argon'])).toBe(before)
    expect(priceOn(MODELS['gemini-4-argon'])).toBe(MODELS['gemini-4-argon'])
  })

  it('models without a schedule never change', () => {
    for (const [id, m] of Object.entries(MODELS)) {
      if (m.schedule) continue
      expect(priceOn(m, '2030-01-01')).toBe(m)
      expect(price(id, '2026-11-30')).toEqual(price(id, '2030-01-01'))
    }
  })

  it('upcomingChanges lists only changes after today, grouped by date and prices, earliest first', () => {
    expect(upcomingChanges('2026-11-30')).toEqual([
      { from: '2026-12-01', models: ['Gemini 4 Argon'], in: 4, cached: 0.2, out: 20 },
      { from: '2027-01-01', models: ['Gemini 3.8 Flash', 'Gemini 3.6 Flash'], in: 1.5, cached: 0.15, out: 7.5 },
    ])
    expect(upcomingChanges('2026-12-01').map((u) => u.from)).toEqual(['2027-01-01'])
    expect(upcomingChanges('2026-12-31').map((u) => u.from)).toEqual(['2027-01-01'])
    expect(upcomingChanges('2027-01-01')).toEqual([])
    expect(upcomingChanges('2031-01-01')).toEqual([])
  })
})

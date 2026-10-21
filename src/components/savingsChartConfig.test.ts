import { describe, expect, it } from 'vitest'
import { LINE_COLORS } from './breakEvenChartConfig'
import { hexAlpha, lineLabel, savingsLineStyle } from './savingsChartConfig'

describe('savings chart helpers', () => {
  it('labels each line by its number of pauses over an hour', () => {
    expect([0, 1, 2, 3, 8].map(lineLabel)).toEqual(['0 pauses over 60 min', '1 pause over 60 min', '2 pauses over 60 min', '3 pauses over 60 min', '8 pauses over 60 min'])
  })

  it('walks the red ramp one step per line, light to dark with more pauses, and dashes the 4th and 5th line', () => {
    const styles = [0, 1, 2, 3, 8].map((long, i) => savingsLineStyle(i, long, 99))
    expect(styles.map((s) => s.colorVar)).toEqual(['--red-1', '--red-2', '--red-3', '--red-4', '--red-5'])
    expect(styles.map((s) => s.dash)).toEqual([[], [], [], [6, 3], [2, 3]])
    expect(new Set(styles.map((s) => s.width))).toEqual(new Set([2]))
  })

  it('draws the viewer\'s own line at 3px, whichever line it is', () => {
    for (const [i, long] of [[0, 0], [2, 2], [3, 3], [4, 8]] as const) {
      expect(savingsLineStyle(i, long, long).width).toBe(3)
      expect(savingsLineStyle(i, long, long + 1).width).toBe(2)
    }
  })

  it('makes the zone fills very light: an rgba of the pole at the given alpha', () => {
    expect(hexAlpha('#e34948', 0.08)).toBe('rgba(227, 73, 72, 0.08)')
    expect(hexAlpha('#3987e5', 0.1)).toBe('rgba(57, 135, 229, 0.1)')
  })

  it('on this page the 5 minute line is the blue pole and the 1 hour line the red pole, as on the decision map', () => {
    expect(LINE_COLORS).toEqual({ five: '--pole-blue', hour: '--pole-red' })
  })
})

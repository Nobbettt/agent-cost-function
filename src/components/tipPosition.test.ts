import { describe, expect, it } from 'vitest'
import { tipPosition } from './tipPosition'

const viewport = { width: 1000, height: 700 }
const tip = { width: 260, height: 80 }
const anchor = (left: number, top: number) => ({ left, top, width: 14, height: 14 })

describe('tipPosition', () => {
  it('opens below the icon, centred on it', () => {
    expect(tipPosition(anchor(400, 100), tip, viewport)).toEqual({ left: 400 + 7 - 130, top: 100 + 14 + 6 })
  })

  it('keeps 8px inside the left edge', () => {
    expect(tipPosition(anchor(10, 100), tip, viewport).left).toBe(8)
  })

  it('keeps 8px inside the right edge (the sidebar case)', () => {
    const { left } = tipPosition(anchor(990, 100), tip, viewport)
    expect(left).toBe(1000 - 260 - 8)
    expect(left + tip.width).toBeLessThanOrEqual(viewport.width - 8)
  })

  it('flips above when there is no room below and room above', () => {
    const { top } = tipPosition(anchor(400, 650), tip, viewport)
    expect(top).toBe(650 - 6 - 80)
  })

  it('stays below when it fits neither way', () => {
    expect(tipPosition(anchor(400, 20), { width: 260, height: 700 }, viewport).top).toBe(20 + 14 + 6)
  })

  it('pins to the left margin when the tip is wider than the viewport', () => {
    expect(tipPosition(anchor(50, 100), { width: 400, height: 40 }, { width: 300, height: 700 }).left).toBe(8)
  })
})

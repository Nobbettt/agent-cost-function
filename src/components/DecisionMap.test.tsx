import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETUPS, DEFAULT_SHARED } from '../data/defaults'
import { breakEvenGrid } from '../model/breakEven'
import { DecisionMap } from './DecisionMap'

const money = (v: number) => `$${v.toFixed(2)}`
const grid = breakEvenGrid(DEFAULT_SETUPS.A, DEFAULT_SHARED, 12, 6)
const show = (yourShort = 2, yourLong = 0, maxShort = 12, maxLong = 6) =>
  render(<DecisionMap grid={grid} maxShort={maxShort} maxLong={maxLong} yourShort={yourShort} yourLong={yourLong} format={money} />)
const cell = (short: number, long: number) => document.querySelector<SVGRectElement>(`.map-cell[data-short="${short}"][data-long="${long}"]`)!

describe('DecisionMap', () => {
  it('is one grid with a cell for every mix: 13 x 7, rows from the most long pauses down to none', () => {
    show()
    const g = screen.getByRole('grid')
    expect(g.getAttribute('aria-label')).toContain('Which cache is cheaper')
    expect(within(g as unknown as HTMLElement).getAllByRole('gridcell')).toHaveLength(13 * 7)
    const rows = within(g as unknown as HTMLElement).getAllByRole('row')
    expect(rows).toHaveLength(7)
    expect([...rows[0].querySelectorAll('.map-cell')].every((c) => c.getAttribute('data-long') === '6')).toBe(true)
    expect([...rows[6].querySelectorAll('.map-cell')].every((c) => c.getAttribute('data-long') === '0')).toBe(true)
  })

  it('gives every cell an aria-label with the tooltip words, and colours it by the side and step', () => {
    show()
    expect(cell(2, 0).getAttribute('aria-label')).toBe('5–60 min: 2 · over 60 min: 0. 5 min cache $30.70. 1 hour cache $28.92. 1 hour cache saves $1.78')
    expect(cell(2, 3).getAttribute('aria-label')).toBe('5–60 min: 2 · over 60 min: 3. 5 min cache $37.82. 1 hour cache $40.50. 1 hour cache costs $2.68 more')
    expect(cell(0, 0).getAttribute('data-side')).toBe('5m')
    expect(cell(12, 0).getAttribute('data-side')).toBe('1h')
    expect(cell(12, 0).getAttribute('data-step')).toBe('4')
    for (const c of document.querySelectorAll('.map-cell')) expect(c.getAttribute('aria-label')).toMatch(/^5–60 min: \d+ · over 60 min: \d+\. 5 min cache \$/)
  })

  it('marks the viewer\'s own cell with an outline and a dot, and draws the dashed break-even line', () => {
    const { container } = show(2, 3)
    const mine = container.querySelector('.map-yours')!
    const own = cell(2, 3)
    expect(Number(mine.getAttribute('x'))).toBe(Number(own.getAttribute('x')))
    expect(Number(mine.getAttribute('y'))).toBe(Number(own.getAttribute('y')))
    expect(container.querySelector('.map-dot')).toBeTruthy()
    const points = container.querySelector('.map-boundary')!.getAttribute('points')!.split(' ').map((p) => p.split(',').map(Number))
    expect(points).toHaveLength(7)
    // The boundary moves right as the row goes up: more long pauses, more short ones needed.
    const xs = points.map((p) => p[0])
    expect([...xs].sort((a, b) => a - b)).toEqual(xs)
  })

  it('has a legend with the three poles and the break-even line', () => {
    show()
    const key = screen.getByRole('list', { name: 'Key' })
    expect(within(key).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['5 min cache cheaper', 'about equal', '1 hour cache cheaper', 'break-even'])
  })

  it('has axis titles and integer ticks', () => {
    const { container } = show()
    const texts = [...container.querySelectorAll('.map-axis text')].map((t) => t.textContent)
    expect(texts).toContain('Pauses of 5–60 min')
    expect(texts).toContain('Pauses over 60 min')
    expect(texts.filter((t) => /^\d+$/.test(t!)).length).toBeGreaterThan(6)
  })

  it('has one tab stop (roving tabindex), on the viewer\'s cell', () => {
    show(4, 2)
    const stops = [...document.querySelectorAll('.map-cell')].filter((c) => c.getAttribute('tabindex') === '0')
    expect(stops).toHaveLength(1)
    expect(stops[0]).toBe(cell(4, 2))
  })

  it('arrow keys move focus and the tooltip: right, up, left, down, Home, End, clamped at the edges', () => {
    show(2, 0)
    const g = screen.getByRole('grid')
    act(() => cell(2, 0).focus())
    expect(document.querySelector('.map-tip')!.textContent).toContain('5–60 min: 2 · over 60 min: 0')
    fireEvent.keyDown(g, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(cell(3, 0))
    expect(document.querySelector('.map-tip')!.textContent).toContain('5–60 min: 3 · over 60 min: 0')
    fireEvent.keyDown(g, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(cell(3, 1))
    expect(cell(3, 1).getAttribute('tabindex')).toBe('0')
    expect(cell(2, 0).getAttribute('tabindex')).toBe('-1')
    fireEvent.keyDown(g, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(cell(2, 1))
    fireEvent.keyDown(g, { key: 'ArrowDown' })
    fireEvent.keyDown(g, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(cell(2, 0))
    fireEvent.keyDown(g, { key: 'End' })
    expect(document.activeElement).toBe(cell(12, 0))
    fireEvent.keyDown(g, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(cell(12, 0))
    fireEvent.keyDown(g, { key: 'Home' })
    expect(document.activeElement).toBe(cell(0, 0))
    fireEvent.keyDown(g, { key: 'PageUp' })
    expect(document.activeElement).toBe(cell(0, 6))
    fireEvent.keyDown(g, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(cell(0, 6))
    fireEvent.keyDown(g, { key: 'PageDown' })
    expect(document.activeElement).toBe(cell(0, 0))
    fireEvent.keyDown(g, { key: 'a' })
    expect(document.activeElement).toBe(cell(0, 0))
  })

  it('shows the tooltip on pointer hover and hides it on leave and on blur, with the four lines of words', () => {
    show()
    expect(document.querySelector('.map-tip')).toBeNull()
    fireEvent.pointerEnter(cell(2, 3))
    const tip = document.querySelector('.map-tip')!
    expect(tip.getAttribute('aria-hidden')).toBe('true')
    expect([...tip.children].map((c) => c.textContent)).toEqual(['5–60 min: 2 · over 60 min: 3', '5 min cache $37.82', '1 hour cache $40.50', '1 hour cache costs $2.68 more'])
    fireEvent.pointerLeave(cell(2, 3))
    expect(document.querySelector('.map-tip')).toBeNull()
    act(() => cell(0, 0).focus())
    expect(document.querySelector('.map-tip')).toBeTruthy()
    act(() => cell(0, 0).blur())
    expect(document.querySelector('.map-tip')).toBeNull()
  })

  it('keeps cells at least 10px wide however many columns there are, scrolling inside the card instead of the page', () => {
    const wide = breakEvenGrid(DEFAULT_SETUPS.A, DEFAULT_SHARED, 40, 6)
    render(<DecisionMap grid={wide} maxShort={40} maxLong={6} yourShort={2} yourLong={0} format={money} />)
    const first = document.querySelector('.map-cell[data-short="0"][data-long="0"]')!
    const second = document.querySelector('.map-cell[data-short="1"][data-long="0"]')!
    expect(Number(second.getAttribute('x')) - Number(first.getAttribute('x'))).toBeGreaterThanOrEqual(10)
    expect(document.querySelector('.map-scroll')).toBeTruthy()
  })
})

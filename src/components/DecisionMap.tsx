import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { boundary, type GridCell } from '../model/breakEven'
import { bucketGrid, cellLines, stepColor } from '../model/decisionMap'

interface Props {
  grid: readonly GridCell[]
  maxShort: number
  maxLong: number
  /** The viewer's own scenario, outlined on the map. */
  yourShort: number
  yourLong: number
  format: (usd: number) => string
}

const MARGIN = { left: 48, right: 12, top: 8, bottom: 44 }
const MIN_CELL = 10
const FALLBACK_WIDTH = 640

/** The first of 1, 2, 5, 10 that spaces labels at least `min` px apart. */
const tickStep = (cell: number, min: number): number => [1, 2, 5, 10].find((s) => s * cell >= min) ?? 10

function useWidth<T extends HTMLElement>(ref: React.RefObject<T | null>): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return width
}

/**
 * Which cache is cheaper for every mix of pauses: x = pauses of 5 to 60 minutes, y = pauses over an hour (0 at the bottom).
 * A diverging scale (blue: the 5 minute cache is cheaper, red: the 1 hour cache is, grey: about equal), the break-even
 * boundary as a dashed line, and the viewer's own cell outlined. One focusable grid with arrow-key navigation (roving
 * tabindex); every cell has its tooltip on hover and on focus, and an aria-label with the same words.
 */
export function DecisionMap({ grid, maxShort, maxLong, yourShort, yourLong, format }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const cells = useRef(new Map<string, SVGRectElement>())
  const measured = useWidth(wrap)
  const [active, setActive] = useState({ short: yourShort, long: yourLong })
  const [tip, setTip] = useState<{ short: number; long: number } | null>(null)

  const cols = maxShort + 1
  const rows = maxLong + 1
  const available = (measured || FALLBACK_WIDTH) - MARGIN.left - MARGIN.right
  const cw = Math.max(MIN_CELL, available / cols)
  const plotW = cw * cols
  const totalH = (measured || FALLBACK_WIDTH) < 500 ? 300 : 320
  const plotH = Math.max(rows * MIN_CELL, totalH - MARGIN.top - MARGIN.bottom)
  const ch = plotH / rows
  const width = MARGIN.left + plotW + MARGIN.right
  const height = MARGIN.top + plotH + MARGIN.bottom

  const buckets = useMemo(() => bucketGrid(grid), [grid])
  const byKey = useMemo(() => new Map(grid.map((c) => [`${c.short},${c.long}`, c])), [grid])
  const edge = useMemo(() => boundary(grid), [grid])

  const xOf = (short: number) => MARGIN.left + short * cw
  const yOf = (long: number) => MARGIN.top + (maxLong - long) * ch
  const xTicks = Array.from({ length: cols }, (_, s) => s).filter((s) => s % tickStep(cw, 24) === 0)
  const yTicks = Array.from({ length: rows }, (_, l) => l).filter((l) => l % tickStep(ch, 16) === 0)
  const path = edge.filter((e) => e.exact !== null).map((e) => `${MARGIN.left + (e.exact! + 0.5) * cw},${yOf(e.long) + ch / 2}`).join(' ')

  const move = (short: number, long: number) => {
    const next = { short: Math.min(maxShort, Math.max(0, short)), long: Math.min(maxLong, Math.max(0, long)) }
    setActive(next)
    cells.current.get(`${next.short},${next.long}`)?.focus()
  }
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const { short, long } = active
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [short - 1, long], ArrowRight: [short + 1, long], ArrowUp: [short, long + 1], ArrowDown: [short, long - 1],
      Home: [0, long], End: [maxShort, long], PageUp: [short, maxLong], PageDown: [short, 0],
    }
    const to = moves[e.key]
    if (!to) return
    e.preventDefault()
    move(...to)
  }

  const tipCell = tip ? byKey.get(`${tip.short},${tip.long}`) : undefined
  const tipX = tip ? xOf(tip.short) + cw / 2 : 0
  const tipY = tip ? yOf(tip.long) : 0

  return (
    <div className="decision-map">
      <ul className="map-key" aria-label="Key">
        <li><span className="swatch" style={{ background: 'var(--pole-blue)' }} />5 min cache cheaper</li>
        <li><span className="swatch" style={{ background: 'var(--pole-neutral)' }} />about equal</li>
        <li><span className="swatch" style={{ background: 'var(--pole-red)' }} />1 hour cache cheaper</li>
        <li><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 3" /></svg>break-even</li>
      </ul>
      <div className="map-scroll" ref={wrap}>
        <div className="map-box" style={{ width }}>
          <svg
            width={width} height={height} role="grid" aria-label="Which cache is cheaper, by pauses of 5–60 min and pauses over 60 min"
            aria-rowcount={rows} aria-colcount={cols} onKeyDown={onKeyDown}
          >
            {Array.from({ length: rows }, (_, i) => maxLong - i).map((long) => (
              <g key={long} role="row" aria-rowindex={maxLong - long + 1}>
                {Array.from({ length: cols }, (_, short) => {
                  const cell = byKey.get(`${short},${long}`)!
                  const bucket = buckets.get(cell)!
                  const isActive = active.short === short && active.long === long
                  return (
                    <rect
                      key={short} ref={(el) => { if (el) cells.current.set(`${short},${long}`, el); else cells.current.delete(`${short},${long}`) }}
                      className="map-cell" role="gridcell" aria-colindex={short + 1} aria-label={cellLines(cell, format).join('. ')}
                      tabIndex={isActive ? 0 : -1} data-short={short} data-long={long} data-side={bucket.side} data-step={bucket.step}
                      x={xOf(short) + 1} y={yOf(long) + 1} width={cw - 2} height={ch - 2} rx={2} style={{ fill: stepColor(bucket) }}
                      onPointerEnter={() => setTip({ short, long })} onPointerLeave={() => setTip(null)}
                      onFocus={() => { setActive({ short, long }); setTip({ short, long }) }} onBlur={() => setTip(null)}
                    />
                  )
                })}
              </g>
            ))}
            <g aria-hidden="true" className="map-axis">
              {xTicks.map((s) => <text key={`x${s}`} x={xOf(s) + cw / 2} y={MARGIN.top + plotH + 16} textAnchor="middle">{s}</text>)}
              {yTicks.map((l) => <text key={`y${l}`} x={MARGIN.left - 8} y={yOf(l) + ch / 2} textAnchor="end" dominantBaseline="central">{l}</text>)}
              <text className="map-title" x={MARGIN.left + plotW / 2} y={height - 6} textAnchor="middle">Pauses of 5–60 min</text>
              <text className="map-title" transform={`translate(12 ${MARGIN.top + plotH / 2}) rotate(-90)`} textAnchor="middle">Pauses over 60 min</text>
              {path && <polyline className="map-boundary" points={path} fill="none" />}
              <rect className="map-yours" x={xOf(yourShort) + 1} y={yOf(yourLong) + 1} width={cw - 2} height={ch - 2} rx={2} fill="none" />
              <circle className="map-dot" cx={xOf(yourShort) + cw / 2} cy={yOf(yourLong) + ch / 2} r={Math.min(3, cw / 4, ch / 4)} />
            </g>
          </svg>
          {tip && tipCell && (
            <div className="map-tip" aria-hidden="true" style={{ left: tipX, top: tipY, transform: `translate(${tip.short > maxShort / 2 ? '-100%' : '0'}, ${tipY > 130 ? 'calc(-100% - 6px)' : `${ch + 6}px`})` }}>
              {cellLines(tipCell, format).map((line, i) => <div key={line} className={i === 0 ? 'map-tip-title' : undefined}>{line}</div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

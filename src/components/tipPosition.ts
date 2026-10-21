export interface Box {
  left: number
  top: number
  width: number
  height: number
}

const MARGIN = 8
const GAP = 6

/**
 * Where to put a tip (viewport coordinates): centred under the anchor, shifted so it stays at least
 * 8px inside the viewport, flipped above the anchor when there is no room below (and room above).
 */
export function tipPosition(anchor: Box, tip: Pick<Box, 'width' | 'height'>, viewport: Pick<Box, 'width' | 'height'>) {
  const below = anchor.top + anchor.height + GAP
  const above = anchor.top - GAP - tip.height
  const top = below + tip.height > viewport.height - MARGIN && above >= MARGIN ? above : below
  const centred = anchor.left + anchor.width / 2 - tip.width / 2
  const left = Math.min(Math.max(MARGIN, centred), Math.max(MARGIN, viewport.width - tip.width - MARGIN))
  return { left, top }
}

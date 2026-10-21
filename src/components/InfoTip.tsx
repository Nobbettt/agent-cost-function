import { useCallback, useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { tipPosition } from './tipPosition'

// Only one tip is open at a time: a tiny shared store of the open tip's id.
let openId: string | null = null
const listeners = new Set<() => void>()
function setOpenId(next: string | null) {
  if (openId === next) return
  openId = next
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

function QuestionMark() {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <circle cx="7" cy="7" r="6.2" />
      <path d="M5.3 5.5a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.9.7-.9 1.3" />
      <circle cx="7" cy="10.3" r=".6" fill="currentColor" stroke="none" />
    </svg>
  )
}

interface Props {
  /** The field's label; the button is named "About <label>". */
  label: string
  text: string
}

/**
 * A "?" button with a tooltip. Shown on mouse hover and keyboard focus, toggled by a tap or click,
 * hidden by Esc (focus stays on the button), blur, mouse leave, scrolling or a press elsewhere.
 * The bubble is portalled to <body> so no scroll container or stacking context can clip it, and it
 * is always in the DOM so aria-describedby resolves.
 */
export function InfoTip({ label, text }: Props) {
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  // How the current interaction started: null for the keyboard, else the pointer type.
  const pointer = useRef<string | null>(null)
  const open = useSyncExternalStore(subscribe, () => openId === id, () => false)

  const show = () => setOpenId(id)
  const hide = useCallback(() => {
    if (openId === id) setOpenId(null)
  }, [id])

  // Place the bubble when it opens: below the icon, kept 8px inside the viewport, flipped above if needed.
  useLayoutEffect(() => {
    const b = button.current
    const t = bubble.current
    if (!open || !b || !t) return
    t.style.left = '0px' // measure at the natural width, not squeezed by a previous position
    const a = b.getBoundingClientRect()
    const size = t.getBoundingClientRect()
    const { left, top } = tipPosition(
      { left: a.left, top: a.top, width: a.width, height: a.height },
      { width: size.width, height: size.height },
      { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
    )
    t.style.left = `${left}px`
    t.style.top = `${top}px`
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Capture phase: close only the tip, not an open drawer behind it.
      e.stopPropagation()
      hide()
    }
    const onPress = (e: Event) => {
      if (!button.current?.contains(e.target as Node)) hide()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPress)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPress)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [open, hide])

  useEffect(() => hide, [hide])

  return (
    <span className="info-tip">
      <button
        ref={button} type="button" className="info-btn" aria-label={`About ${label}`} aria-describedby={id}
        onPointerEnter={(e) => e.pointerType !== 'touch' && show()}
        onPointerLeave={hide}
        onPointerDown={(e) => {
          pointer.current = e.pointerType || 'unknown'
        }}
        onFocus={() => {
          if (pointer.current === null) show()
        }}
        onBlur={() => {
          pointer.current = null
          hide()
        }}
        onClick={() => {
          // A mouse click keeps the hover tip open; taps and the keyboard toggle it.
          if (pointer.current === 'mouse' || pointer.current === 'pen') show()
          else if (open) hide()
          else show()
        }}
      >
        <QuestionMark />
      </button>
      {createPortal(
        <div ref={bubble} id={id} role="tooltip" className={open ? 'info-bubble is-open' : 'info-bubble'}>{text}</div>,
        document.body,
      )}
    </span>
  )
}

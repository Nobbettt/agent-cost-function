import { useEffect, useRef, useState } from 'react'
import { SHARE_TEXT_QUERY } from '../data/breakpoints'
import { useMediaQuery } from '../hooks/useMediaQuery'

const TITLE = 'Agent Cost Function'
const STATUS_MS = 2000

function ShareIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="3.5" r="1.8" />
      <circle cx="4" cy="8" r="1.8" />
      <circle cx="12" cy="12.5" r="1.8" />
      <path d="M5.6 7.1l4.8-2.7M5.6 8.9l4.8 2.7" />
    </svg>
  )
}

/**
 * Shares the current link. On a touch device with a native share sheet it opens the sheet; otherwise it
 * copies to the clipboard and says "Link copied"; if that is impossible it shows the link in a small
 * popover to copy by hand.
 */
export function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const [manual, setManual] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const input = useRef<HTMLInputElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  // With the text shown the name comes from it; icon-only, from an aria-label (so the name is "Share current view" either way).
  const withText = useMediaQuery(SHARE_TEXT_QUERY, true)

  useEffect(() => () => clearTimeout(timer.current), [])

  // The popover opens with the link selected, so Ctrl/Cmd+C is all that is left to do; Esc or a press elsewhere closes it.
  useEffect(() => {
    if (!manual) return
    input.current?.focus()
    input.current?.select()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setManual(false)
      button.current?.focus()
    }
    const onPress = (e: Event) => {
      const t = e.target as Node
      if (!input.current?.closest('.share-popover')?.contains(t) && !button.current?.contains(t)) setManual(false)
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPress)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPress)
    }
  }, [manual])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setManual(false)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), STATUS_MS)
    } catch {
      // No clipboard API, or it was refused: let the person copy it by hand.
      setCopied(false)
      setManual(true)
    }
  }

  async function share() {
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
    if (typeof navigator.share === 'function' && coarse) {
      try {
        await navigator.share({ title: TITLE, url })
      } catch (error) {
        // Dismissing the sheet is not an error; anything else falls back to copying.
        if (!(error instanceof DOMException && error.name === 'AbortError')) await copy()
      }
      return
    }
    await copy()
  }

  return (
    <span className="share">
      <button ref={button} type="button" className="share-btn" aria-label={withText ? undefined : 'Share current view'} onClick={share}>
        <ShareIcon />
        {withText && <span className="share-label">Share Current View</span>}
      </button>
      {copied && <span className="share-status" role="status">Link copied</span>}
      {manual && (
        <div className="share-popover" role="dialog" aria-label="Copy the link">
          <input ref={input} readOnly value={url} aria-label="Link to this comparison" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="share-close" onClick={() => { setManual(false); button.current?.focus() }}>Close</button>
        </div>
      )}
    </span>
  )
}

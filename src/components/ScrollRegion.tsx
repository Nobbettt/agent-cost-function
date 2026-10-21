import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A page's scroll container. Focusable by script only (tabIndex -1, no focus ring), and focused on load
 * when nothing else has focus, so Space and PageDown scroll it straight away.
 */
export function ScrollRegion({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const active = document.activeElement
    if (!active || active === document.body) ref.current?.focus({ preventScroll: true })
  }, [])
  return (
    <div ref={ref} className={`${className} scroll-region`} tabIndex={-1}>
      {children}
    </div>
  )
}

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockMatchMedia } from '../test-matchmedia'
import { ShareButton } from './ShareButton'

const URL_ = 'https://example.com/?v=1&a=claude-opus-5-5,1h,low,kept,2'
const button = () => screen.getByRole('button', { name: 'Share link' })
const click = () => act(async () => { fireEvent.click(button()) })
const define = (name: 'clipboard' | 'share', value: unknown) => Object.defineProperty(navigator, name, { value, configurable: true, writable: true })

afterEach(() => {
  for (const name of ['clipboard', 'share']) Reflect.deleteProperty(navigator, name)
})

describe('ShareButton: copying', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('has a visible "Share" label, an aria-hidden icon and the name "Share link"', () => {
    render(<ShareButton url={URL_} />)
    expect(button().textContent).toBe('Share')
    expect(button().querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('copies the url and shows "Link copied" for about two seconds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    define('clipboard', { writeText })
    render(<ShareButton url={URL_} />)
    expect(screen.queryByRole('status')).toBeNull()
    await click()
    expect(writeText).toHaveBeenCalledWith(URL_)
    expect(screen.getByRole('status').textContent).toBe('Link copied')
    await act(async () => { vi.advanceTimersByTime(1999) })
    expect(screen.queryByRole('status')).toBeTruthy()
    await act(async () => { vi.advanceTimersByTime(2) })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('a second click restarts the timer', async () => {
    define('clipboard', { writeText: vi.fn().mockResolvedValue(undefined) })
    render(<ShareButton url={URL_} />)
    await click()
    await act(async () => { vi.advanceTimersByTime(1500) })
    await click()
    await act(async () => { vi.advanceTimersByTime(1500) })
    expect(screen.queryByRole('status')).toBeTruthy()
    await act(async () => { vi.advanceTimersByTime(600) })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('uses the clipboard, not the share sheet, with a fine pointer even where navigator.share exists', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const share = vi.fn()
    define('clipboard', { writeText })
    define('share', share)
    mockMatchMedia(false)
    render(<ShareButton url={URL_} />)
    await click()
    expect(share).not.toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith(URL_)
  })
})

describe('ShareButton: the native share sheet', () => {
  it('opens on a coarse pointer with the title and url, and does not copy', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn()
    define('share', share)
    define('clipboard', { writeText })
    mockMatchMedia(true)
    render(<ShareButton url={URL_} />)
    await click()
    expect(share).toHaveBeenCalledWith({ title: 'Agent Cost Function', url: URL_ })
    expect(writeText).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('a dismissed sheet (AbortError) is not an error: no copy, no popover', async () => {
    const writeText = vi.fn()
    define('share', vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')))
    define('clipboard', { writeText })
    mockMatchMedia(true)
    render(<ShareButton url={URL_} />)
    await click()
    expect(writeText).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('any other share failure falls back to copying', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    define('share', vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError')))
    define('clipboard', { writeText })
    mockMatchMedia(true)
    render(<ShareButton url={URL_} />)
    await click()
    expect(writeText).toHaveBeenCalledWith(URL_)
    expect(screen.getByRole('status').textContent).toBe('Link copied')
  })
})

describe('ShareButton: copy by hand', () => {
  it('without a clipboard API, shows a popover with the url selected', async () => {
    render(<ShareButton url={URL_} />)
    await click()
    const dialog = screen.getByRole('dialog', { name: 'Copy the link' })
    const input = dialog.querySelector('input') as HTMLInputElement
    expect(input.value).toBe(URL_)
    expect(input.readOnly).toBe(true)
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, URL_.length])
    expect(document.activeElement).toBe(input)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('also when the clipboard refuses', async () => {
    define('clipboard', { writeText: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')) })
    render(<ShareButton url={URL_} />)
    await click()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('Esc closes it and returns focus to the button', async () => {
    render(<ShareButton url={URL_} />)
    await click()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(button())
  })

  it('the Close button and a press elsewhere close it too', async () => {
    render(<><ShareButton url={URL_} /><p>elsewhere</p></>)
    await click()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await click()
    fireEvent.pointerDown(screen.getByText('elsewhere'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a later successful copy replaces the popover with "Link copied"', async () => {
    render(<ShareButton url={URL_} />)
    await click()
    define('clipboard', { writeText: vi.fn().mockResolvedValue(undefined) })
    await click()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Link copied')
  })
})

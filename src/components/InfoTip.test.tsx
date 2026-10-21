import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field } from './Field'
import { InfoTip } from './InfoTip'

const button = (name: string) => screen.getByRole('button', { name: `About ${name}` })
const tipOf = (btn: HTMLElement) => document.getElementById(btn.getAttribute('aria-describedby')!)!
const isOpen = (btn: HTMLElement) => tipOf(btn).classList.contains('is-open')

describe('InfoTip', () => {
  it('is a button named after the field, wired to a tooltip that is always in the DOM', () => {
    render(<InfoTip label="Model" text="The model the session runs on." />)
    const btn = button('Model')
    expect(btn.getAttribute('type')).toBe('button')
    const tip = tipOf(btn)
    expect(tip.getAttribute('role')).toBe('tooltip')
    expect(tip.textContent).toBe('The model the session runs on.')
    expect(isOpen(btn)).toBe(false)
    expect(btn.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    // Portalled out of any scroll container.
    expect(tip.parentElement).toBe(document.body)
  })

  it('shows on mouse hover and hides on mouse leave', () => {
    render(<InfoTip label="Model" text="x" />)
    const btn = button('Model')
    fireEvent.pointerEnter(btn, { pointerType: 'mouse' })
    expect(isOpen(btn)).toBe(true)
    fireEvent.pointerLeave(btn, { pointerType: 'mouse' })
    expect(isOpen(btn)).toBe(false)
  })

  it('shows on keyboard focus and hides on blur', () => {
    render(<InfoTip label="Model" text="x" />)
    const btn = button('Model')
    act(() => btn.focus())
    expect(isOpen(btn)).toBe(true)
    act(() => btn.blur())
    expect(isOpen(btn)).toBe(false)
  })

  it('Esc hides it and keeps focus on the button', () => {
    render(<InfoTip label="Model" text="x" />)
    const btn = button('Model')
    act(() => btn.focus())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(isOpen(btn)).toBe(false)
    expect(document.activeElement).toBe(btn)
  })

  it('other keys leave it open', () => {
    render(<InfoTip label="Model" text="x" />)
    const btn = button('Model')
    act(() => btn.focus())
    fireEvent.keyDown(document, { key: 'a' })
    expect(isOpen(btn)).toBe(true)
  })

  it('a tap toggles it, and pressing elsewhere closes it', () => {
    render(<><InfoTip label="Model" text="x" /><p>elsewhere</p></>)
    const btn = button('Model')
    fireEvent.pointerDown(btn, { pointerType: 'touch' })
    fireEvent.click(btn)
    expect(isOpen(btn)).toBe(true)
    fireEvent.click(btn)
    expect(isOpen(btn)).toBe(false)
    fireEvent.click(btn)
    expect(isOpen(btn)).toBe(true)
    fireEvent.pointerDown(screen.getByText('elsewhere'), { pointerType: 'touch' })
    expect(isOpen(btn)).toBe(false)
  })

  it('a touch focus does not open it before the tap toggles it (no open-then-close flicker)', () => {
    render(<InfoTip label="Model" text="x" />)
    const btn = button('Model')
    fireEvent.pointerDown(btn, { pointerType: 'touch' })
    act(() => btn.focus())
    expect(isOpen(btn)).toBe(false)
    fireEvent.click(btn)
    expect(isOpen(btn)).toBe(true)
  })

  it('a mouse click keeps the hover tip open instead of toggling it shut', () => {
    render(<InfoTip label="Model" text="x" />)
    const btn = button('Model')
    fireEvent.pointerEnter(btn, { pointerType: 'mouse' })
    fireEvent.pointerDown(btn, { pointerType: 'mouse' })
    fireEvent.click(btn)
    expect(isOpen(btn)).toBe(true)
  })

  it('the keyboard can toggle it with Enter', () => {
    render(<InfoTip label="Model" text="x" />)
    const btn = button('Model')
    act(() => btn.focus())
    fireEvent.click(btn)
    expect(isOpen(btn)).toBe(false)
    fireEvent.click(btn)
    expect(isOpen(btn)).toBe(true)
  })

  it('only one tip is open at a time', () => {
    render(<><InfoTip label="One" text="1" /><InfoTip label="Two" text="2" /></>)
    fireEvent.pointerEnter(button('One'), { pointerType: 'mouse' })
    fireEvent.pointerEnter(button('Two'), { pointerType: 'mouse' })
    expect(isOpen(button('One'))).toBe(false)
    expect(isOpen(button('Two'))).toBe(true)
    act(() => button('One').focus())
    expect(isOpen(button('One'))).toBe(true)
    expect(isOpen(button('Two'))).toBe(false)
  })

  it('closes on scroll and resize, and positions itself when it opens', () => {
    render(<InfoTip label="Model" text="x" />)
    const btn = button('Model')
    fireEvent.pointerEnter(btn, { pointerType: 'mouse' })
    // jsdom has no layout: zero-size rects give the 8px margin and the 6px gap.
    expect(tipOf(btn).style.left).toBe('8px')
    expect(tipOf(btn).style.top).toBe('6px')
    fireEvent.scroll(window)
    expect(isOpen(btn)).toBe(false)
    fireEvent.pointerEnter(btn, { pointerType: 'mouse' })
    fireEvent(window, new Event('resize'))
    expect(isOpen(btn)).toBe(false)
  })

  it('closes when it unmounts while open', () => {
    const { unmount } = render(<><InfoTip label="One" text="1" /></>)
    fireEvent.pointerEnter(button('One'), { pointerType: 'mouse' })
    unmount()
    render(<InfoTip label="Two" text="2" />)
    expect(isOpen(button('Two'))).toBe(false)
    act(() => button('Two').focus())
    expect(isOpen(button('Two'))).toBe(true)
  })
})

describe('Field', () => {
  it('puts the label and tip in a head row, with the tip outside the label', () => {
    render(<Field id="f" label="Interruptions" help="How many pauses."><input id="f" /></Field>)
    const label = screen.getByText('Interruptions')
    expect(label.tagName).toBe('LABEL')
    expect(label.getAttribute('for')).toBe('f')
    expect(label.contains(button('Interruptions'))).toBe(false)
    expect(label.parentElement).toBe(button('Interruptions').closest('.field-head'))
    expect(screen.getByLabelText('Interruptions').id).toBe('f')
  })

  it('clicking the "?" does not focus the input', () => {
    render(<Field id="f" label="Interruptions" help="How many pauses."><input id="f" /></Field>)
    fireEvent.click(button('Interruptions'))
    expect(document.activeElement).not.toBe(screen.getByLabelText('Interruptions'))
  })
})

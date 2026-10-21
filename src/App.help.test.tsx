import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { FIELD_HELP, thinkingHelp } from './data/fieldHelp'
import { ALL_EFFORTS } from './data/pricing'
import { mockMatchMedia } from './test-matchmedia'

vi.mock('./components/CostChart', () => ({ CostChart: () => null }))

// Every field's label (as the "About <label>" button names it) and the text its tip must show.
const SETUP_HELP: [string, string][] = [
  ['Provider', FIELD_HELP.provider],
  ['Model', FIELD_HELP.model],
  ['Prompt cache', FIELD_HELP.cache],
  ['Reasoning effort', FIELD_HELP.effort],
  ['Earlier reasoning in context', FIELD_HELP.reasoning],
  ['Interruptions', FIELD_HELP.interruptions],
  ['Pause per interruption (min)', FIELD_HELP.pause],
]
const ADVANCED_HELP: [string, string][] = [
  ['Session length (tokens)', FIELD_HELP.session],
  ['System prompt + tools (tokens)', FIELD_HELP.base],
  ['Added per request (tokens)', FIELD_HELP.growth],
  ['Output per request (tokens)', FIELD_HELP.visibleOut],
  ...ALL_EFFORTS.map((e): [string, string] => [`Reasoning tokens: ${e}`, thinkingHelp(e)]),
]

const tipText = (btn: HTMLElement) => document.getElementById(btn.getAttribute('aria-describedby')!)?.textContent

describe('field help tips', () => {
  it('every setup field has a tip with the exact text, in both setups', () => {
    render(<App />)
    for (const id of ['A', 'B']) {
      const box = within(screen.getByRole('group', { name: `Setup ${id}` }))
      for (const [label, text] of SETUP_HELP) expect(tipText(box.getByRole('button', { name: `About ${label}` }))).toBe(text)
    }
  })

  it('every Advanced settings field has a tip with the exact text', () => {
    render(<App />)
    const advanced = document.getElementById('advanced')!
    for (const [label, text] of ADVANCED_HELP) expect(tipText(within(advanced).getByRole('button', { name: `About ${label}` }))).toBe(text)
    expect(ADVANCED_HELP).toHaveLength(10)
  })

  it('the currency select has its tip in the navbar', () => {
    render(<App />)
    const nav = within(screen.getByRole('navigation', { name: 'Main' }))
    expect(tipText(nav.getByRole('button', { name: 'About Currency' }))).toBe(FIELD_HELP.currency)
  })

  it('has no tips beyond those fields', () => {
    render(<App />)
    expect(document.querySelectorAll('.info-btn')).toHaveLength(2 * SETUP_HELP.length + ADVANCED_HELP.length + 1)
  })

  it('labels still focus their inputs, and the tips are outside the labels', () => {
    render(<App />)
    for (const btn of document.querySelectorAll('.info-btn')) expect(btn.closest('label')).toBeNull()
    expect((screen.getByLabelText('Session length (tokens)') as HTMLInputElement).type).toBe('number')
  })

  it('Esc closes an open tip first and leaves the drawer open; a second Esc closes the drawer', () => {
    mockMatchMedia(false)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const drawerTip = document.querySelector<HTMLElement>('#settings-panel .info-btn')!
    fireEvent.pointerEnter(drawerTip, { pointerType: 'mouse' })
    expect(document.getElementById(drawerTip.getAttribute('aria-describedby')!)!.classList.contains('is-open')).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.getElementById(drawerTip.getAttribute('aria-describedby')!)!.classList.contains('is-open')).toBe(false)
    expect(screen.getByRole('button', { name: 'Settings' }).getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Settings' }).getAttribute('aria-expanded')).toBe('false')
  })
})

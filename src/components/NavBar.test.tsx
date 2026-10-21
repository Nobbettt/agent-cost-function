import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockMatchMedia } from '../test-matchmedia'
import { NavBar } from './NavBar'

const bar = () => within(screen.getByRole('navigation', { name: 'Main' }))

describe('NavBar', () => {
  it('on the calculator: brand is the current link, other pages link out, Settings button present', () => {
    render(<NavBar page="calculator" settings={{ open: true, onToggle: () => {} }} />)
    const brand = bar().getByRole('link', { name: 'Agent Cost Function' })
    expect(brand.getAttribute('href')).toBe('/')
    expect(brand.getAttribute('aria-current')).toBe('page')
    expect(bar().getAllByRole('link').map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Agent Cost FunctionACF', '/'],
      ['How it is calculated', '/how-it-works/'],
      ['Sources', '/sources/'],
    ])
    expect(bar().getByRole('button', { name: 'Settings' })).toBeTruthy()
  })

  it.each([
    ['how-it-works', 'How it is calculated', 'Sources', '/sources/'],
    ['sources', 'Sources', 'How it is calculated', '/how-it-works/'],
  ] as const)('on %s: that entry is aria-current text, no Settings button', (page, current, other, href) => {
    render(<NavBar page={page} />)
    const here = bar().getByText(current)
    expect(here.getAttribute('aria-current')).toBe('page')
    expect(here.tagName).not.toBe('A')
    expect(bar().queryByRole('link', { name: current })).toBeNull()
    expect(bar().getByRole('link', { name: other }).getAttribute('href')).toBe(href)
    const brand = bar().getByRole('link', { name: 'Agent Cost Function' })
    expect(brand.getAttribute('href')).toBe('/')
    expect(brand.getAttribute('aria-current')).toBeNull()
    expect(bar().queryByRole('button')).toBeNull()
  })

  it('keeps same-site links in the same tab', () => {
    render(<NavBar page="calculator" />)
    for (const l of bar().getAllByRole('link')) expect(l.getAttribute('target')).toBeNull()
  })

  it('Settings button reflects the open state and calls onToggle', () => {
    const onToggle = vi.fn()
    const { rerender } = render(<NavBar page="calculator" settings={{ open: false, onToggle }} />)
    const button = bar().getByRole('button', { name: 'Settings' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.getAttribute('aria-controls')).toBe('settings-panel')
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)
    rerender(<NavBar page="calculator" settings={{ open: true, onToggle }} />)
    expect(bar().getByRole('button', { name: 'Settings' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('below 640px the visible link text is shorter, and the accessible name matches it', () => {
    mockMatchMedia(true)
    const { unmount } = render(<NavBar page="calculator" />)
    expect(bar().getByRole('link', { name: 'How it works' }).getAttribute('href')).toBe('/how-it-works/')
    expect(bar().queryByText('How it is calculated')).toBeNull()
    expect(bar().getByRole('link', { name: 'Sources' })).toBeTruthy()
    unmount()
    render(<NavBar page="how-it-works" />)
    expect(bar().getByText('How it works').getAttribute('aria-current')).toBe('page')
  })

  it('at 640px and up it keeps the full text', () => {
    mockMatchMedia(false)
    render(<NavBar page="sources" />)
    expect(bar().getByRole('link', { name: 'How it is calculated' })).toBeTruthy()
  })

  it('keeps the brand and the page links together on the left, and the controls group last on the right', () => {
    render(
      <NavBar
        page="calculator" settings={{ open: false, onToggle: () => {} }}
        controls={<select aria-label="Currency"><option>USD</option></select>}
      />,
    )
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect([...nav.children].map((c) => c.className)).toEqual(['brand', 'nav-links', 'nav-end'])
    const end = nav.querySelector('.nav-end')!
    expect([...end.children].map((c) => c.tagName)).toEqual(['SELECT', 'BUTTON'])
    expect(nav.lastElementChild).toBe(end)
  })

  it('has no controls group on a page without controls, so everything sits on the left', () => {
    render(<NavBar page="sources" />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect([...nav.children].map((c) => c.className)).toEqual(['brand', 'nav-links'])
    expect(nav.querySelector('.nav-end')).toBeNull()
  })
})

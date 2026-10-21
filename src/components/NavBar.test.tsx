import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NavBar } from './NavBar'

const bar = () => within(screen.getByRole('navigation', { name: 'Main' }))

describe('NavBar', () => {
  it('on the calculator: Explore is the current page (plain text), the brand is a plain link, Settings is present', () => {
    render(<NavBar page="calculator" settings={{ open: true, onToggle: () => {} }} />)
    const explore = bar().getByText('Explore')
    expect(explore.getAttribute('aria-current')).toBe('page')
    expect(explore.tagName).not.toBe('A')
    const brand = bar().getByRole('link', { name: 'Agent Cost Function' })
    expect(brand.getAttribute('href')).toBe('/')
    expect(brand.getAttribute('aria-current')).toBeNull()
    expect(bar().getAllByRole('link').map((l) => [l.textContent, l.getAttribute('href')])).toEqual([['Agent Cost FunctionACF', '/']])
    expect(bar().getByRole('button', { name: 'Settings' })).toBeTruthy()
  })

  it.each(['how-it-works', 'sources'] as const)('on %s: Explore is a same-tab link to the calculator and nothing is marked current', (page) => {
    render(<NavBar page={page} />)
    const explore = bar().getByRole('link', { name: 'Explore' })
    expect(explore.getAttribute('href')).toBe('/')
    expect(explore.getAttribute('target')).toBeNull()
    expect(explore.getAttribute('aria-current')).toBeNull()
    expect(bar().getByRole('link', { name: 'Agent Cost Function' }).getAttribute('aria-current')).toBeNull()
    expect(document.querySelector('.navbar [aria-current]')).toBeNull()
    expect(bar().queryByRole('button')).toBeNull()
  })

  it('has exactly one current marker, and no How it is calculated or Sources links', () => {
    for (const page of ['calculator', 'how-it-works', 'sources'] as const) {
      const { unmount } = render(<NavBar page={page} />)
      expect(document.querySelectorAll('.navbar [aria-current]')).toHaveLength(page === 'calculator' ? 1 : 0)
      expect(bar().queryByText(/how it is calculated|how it works|sources/i)).toBeNull()
      expect([...document.querySelectorAll('.navbar a')].map((a) => a.getAttribute('href')).every((h) => h === '/')).toBe(true)
      unmount()
    }
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

  it('keeps the brand and Explore together on the left, and the controls group last on the right', () => {
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

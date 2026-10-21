import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockMatchMedia } from '../test-matchmedia'
import { NavBar } from './NavBar'

const bar = () => within(screen.getByRole('navigation', { name: 'Main' }))

describe('NavBar', () => {
  it('on the calculator: Explore is a link to / that is the current page, the brand is a plain link, and there is no Settings button', () => {
    render(<NavBar page="calculator" />)
    const explore = bar().getByRole('link', { name: 'Explore' })
    expect(explore.tagName).toBe('A')
    expect(explore.getAttribute('href')).toBe('/')
    expect(explore.getAttribute('aria-current')).toBe('page')
    expect(explore.getAttribute('target')).toBeNull()
    const brand = bar().getByRole('link', { name: 'Agent Cost Function' })
    expect(brand.getAttribute('href')).toBe('/')
    expect(brand.getAttribute('aria-current')).toBeNull()
    expect(bar().getAllByRole('link').map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Agent Cost FunctionACF', '/'],
      ['Explore', '/'],
      ['Claude Cache Break-even', '/cache-break-even/'],
    ])
    expect(bar().queryByRole('button')).toBeNull()
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

  it('has at most one current marker: Explore on the calculator, the break-even link on its page, none elsewhere; no How it is calculated or Sources links', () => {
    const current = { calculator: 'Explore', 'cache-break-even': 'Claude Cache Break-even', 'how-it-works': null, sources: null } as const
    for (const page of ['calculator', 'cache-break-even', 'how-it-works', 'sources'] as const) {
      const { unmount } = render(<NavBar page={page} />)
      const marked = [...document.querySelectorAll('.navbar [aria-current]')].map((a) => a.textContent)
      expect(marked).toEqual(current[page] ? [current[page]] : [])
      expect(bar().queryByText(/how it is calculated|how it works|sources/i)).toBeNull()
      expect([...document.querySelectorAll('.navbar a')].map((a) => a.getAttribute('href'))).toEqual(['/', '/', '/cache-break-even/'])
      unmount()
    }
  })

  it('shows the long link text from 640px up and the short one below, as the visible text and so the accessible name', () => {
    mockMatchMedia(true)
    const { unmount } = render(<NavBar page="calculator" />)
    expect(bar().getByRole('link', { name: 'Claude Cache Break-even' }).textContent).toBe('Claude Cache Break-even')
    unmount()
    mockMatchMedia(false)
    render(<NavBar page="calculator" />)
    expect(bar().getByRole('link', { name: 'Cache break-even' }).textContent).toBe('Cache break-even')
    expect(bar().queryByRole('link', { name: 'Claude Cache Break-even' })).toBeNull()
    expect(document.querySelector('.navbar a[aria-label]')).toBeNull()
  })

  it('keeps same-site links in the same tab', () => {
    render(<NavBar page="calculator" />)
    for (const l of bar().getAllByRole('link')) expect(l.getAttribute('target')).toBeNull()
  })

  it('keeps the brand and Explore together on the left, and the controls group last on the right', () => {
    render(
      <NavBar
        page="calculator"
        controls={<select aria-label="Currency"><option>USD</option></select>}
      />,
    )
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect([...nav.children].map((c) => c.className)).toEqual(['brand', 'nav-links', 'nav-end'])
    const end = nav.querySelector('.nav-end')!
    expect([...end.children].map((c) => c.tagName)).toEqual(['SELECT'])
    expect(nav.lastElementChild).toBe(end)
  })

  it('has no controls group on a page without controls, so everything sits on the left', () => {
    render(<NavBar page="sources" />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect([...nav.children].map((c) => c.className)).toEqual(['brand', 'nav-links'])
    expect(nav.querySelector('.nav-end')).toBeNull()
  })
})

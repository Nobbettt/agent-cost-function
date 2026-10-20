import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PRICES_CHECKED } from '../data/pricing'
import { Footer } from './Footer'

const nav = () => screen.getByRole('navigation', { name: 'Site' })

describe('Footer', () => {
  it.each([
    ['calculator', ['How it is calculated', 'Sources'], 0],
    ['how-it-works', ['Calculator', 'Sources'], 1],
    ['sources', ['Calculator', 'How it is calculated'], 1],
  ] as const)('on %s links to the other pages and marks no link as current', (page, links, current) => {
    render(<Footer page={page} />)
    expect(screen.getByRole('contentinfo').textContent).toContain(`Prices and settings checked ${PRICES_CHECKED}`)
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(links)
    expect(nav().querySelectorAll('[aria-current="page"]')).toHaveLength(current)
    for (const l of screen.getAllByRole('link')) expect(l.getAttribute('target')).toBeNull()
  })

  it('uses plain text, not a link, for the current entry', () => {
    render(<Footer page="how-it-works" />)
    expect(nav().querySelector('a[aria-current]')).toBeNull()
    expect(nav().textContent).toBe('Calculator · How it is calculated · Sources')
  })
})

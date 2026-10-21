import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HowItWorksPage } from './HowItWorksPage'

describe('HowItWorksPage', () => {
  it('renders the heading, the lede and the notes list', () => {
    render(<HowItWorksPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'How it is calculated' })).toBeTruthy()
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'calculator' }).getAttribute('href')).toBe('/')
    expect(screen.getAllByRole('listitem').filter((li) => li.closest('main'))).toHaveLength(7)
    expect(screen.getByText(/Every request sends the whole context/)).toBeTruthy()
    expect(screen.getByText('Requests run back to back. Cache breaking interruptions are spread evenly over the session; each one outlasts the cache, so the next request writes the whole context again (marked on the charts).')).toBeTruthy()
    expect(screen.queryByText(/in_memory/)).toBeNull()
    expect(screen.queryByText(/hollow marker/)).toBeNull()
    expect(screen.getByText(/Costs are calculated in USD and converted for display at the daily ECB reference rate/)).toBeTruthy()
  })

  it('has the site nav with this page as aria-current text', () => {
    render(<HowItWorksPage />)
    const nav = within(within(screen.getByRole('contentinfo')).getByRole('navigation', { name: 'Site' }))
    const current = nav.getByText('How it is calculated')
    expect(current.getAttribute('aria-current')).toBe('page')
    expect(current.tagName).not.toBe('A')
    expect(nav.getAllByRole('link').map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Calculator', '/'],
      ['Sources', '/sources/'],
    ])
  })
})

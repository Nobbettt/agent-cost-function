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

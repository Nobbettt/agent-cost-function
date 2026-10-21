import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HowItWorksPage } from './HowItWorksPage'

describe('HowItWorksPage', () => {
  it('renders the heading, the lede and the notes list', () => {
    render(<HowItWorksPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'How it is calculated' })).toBeTruthy()
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'calculator' }).getAttribute('href')).toBe('/')
    expect(screen.getAllByRole('listitem').filter((li) => li.closest('main'))).toHaveLength(9)
    expect(screen.getByText(/Every request sends the whole context/)).toBeTruthy()
    expect(screen.getByText('Requests run back to back. Cache breaking interruptions are spread evenly over the session; each one outlasts the cache, so the next request writes the whole context again (marked on the charts).')).toBeTruthy()
    expect(screen.queryByText(/in_memory/)).toBeNull()
    expect(screen.queryByText(/hollow marker/)).toBeNull()
    expect(screen.getByText('xAI caches automatically with no documented lifetime and no write fee; entries can be evicted at any time. Here every cache break means the next request pays the full input price for the whole context. Reasoning tokens are assumed to cost the output rate.')).toBeTruthy()
    expect(screen.getByText("Google caches implicitly (on by default, no lifetime stated, no write fee, no guarantee). Explicit caches with a TTL and an hourly storage fee aren't modelled. Every cache break means the next request pays the full input price for the whole context.")).toBeTruthy()
    expect(screen.getByText(/Gemini 3.1 Pro Preview bills 2× input and cached input and 1.5× output for the whole request once the prompt passes 200K tokens/)).toBeTruthy()
    expect(screen.getByText(/xAI models bill 2× input, cached input and output for the whole request once the prompt reaches 200K tokens/)).toBeTruthy()
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
      ['Claude Cache Break-even', '/cache-break-even/'],
      ['Sources', '/sources/'],
    ])
  })
})

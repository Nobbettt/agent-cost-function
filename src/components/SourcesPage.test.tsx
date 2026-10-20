import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DOCS, MODELS, PRICES_CHECKED } from '../data/pricing'
import { SourcesPage } from './SourcesPage'

describe('SourcesPage', () => {
  it('renders the heading, the checked date and the model table', () => {
    render(<SourcesPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Sources' })).toBeTruthy()
    expect(screen.getByText(new RegExp(`checked on ${PRICES_CHECKED}`))).toBeTruthy()
    const rows = document.querySelectorAll('table.sources tbody tr')
    expect(rows).toHaveLength(Object.keys(MODELS).length)
  })

  it('lists every doc with what it proves', () => {
    render(<SourcesPage />)
    for (const d of Object.values(DOCS)) {
      expect(screen.getByRole('link', { name: d.url })).toBeTruthy()
      expect(screen.getByText((_, el) => el?.tagName === 'LI' && el.textContent === `${d.url}: ${d.proves}`)).toBeTruthy()
    }
  })

  it('opens external links in a new tab with rel=noopener', () => {
    render(<SourcesPage />)
    const external = [...document.querySelectorAll('main table a, main ul a')]
    expect(external.length).toBeGreaterThan(Object.keys(MODELS).length)
    for (const l of external) {
      expect(l.getAttribute('target')).toBe('_blank')
      expect(l.getAttribute('rel')).toBe('noopener')
    }
  })

  it('links back to the calculator in the same tab', () => {
    render(<SourcesPage />)
    const back = within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Back to the calculator' })
    expect(back.getAttribute('href')).toBe('/')
    expect(back.getAttribute('target')).toBeNull()
    expect(screen.getByRole('link', { name: 'calculator' }).getAttribute('href')).toBe('/')
  })
})

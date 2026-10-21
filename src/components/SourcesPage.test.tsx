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

  it('lists the four xAI models with their prices, the inclusive 200K rule and the pricing page, and says what is not included', () => {
    render(<SourcesPage />)
    const rows = [...document.querySelectorAll('table.sources tbody tr')].map((r) => [...r.children].map((c) => c.textContent))
    const xai = rows.filter((r) => r[0]!.includes('Grok'))
    expect(xai.map((r) => r[0])).toEqual([
      'Grok 4.7 (grok-4.7)', 'Grok 4.6 (grok-4.6)', 'Grok 4.5 (grok-4.5)', 'Grok 4.20 (non-reasoning) (grok-4.20-0309-non-reasoning)',
    ])
    expect(xai[0]).toEqual(['Grok 4.7 (grok-4.7)', '$2', '$0.5 (0.25×)', '$6', 'auto 1×', '≥200K: in 2×, out 2×', '500K', 'low medium high* xhigh', 'kept dropped', 'pricing'])
    expect(xai[3][6]).toBe('1M')
    expect(xai[3][7]).toBe('none')
    expect(xai[2][7]).toBe('low medium high*')
    const links = [...document.querySelectorAll('table.sources tbody tr')].filter((r) => r.textContent!.includes('Grok')).map((r) => r.querySelector('a')!.getAttribute('href'))
    expect(new Set(links)).toEqual(new Set(['https://docs.x.ai/docs/models']))
    expect(screen.getByText('Not included: grok-4.3, grok-4.20 reasoning and multi-agent, grok-build-0.1 (reasoning behaviour not documented).')).toBeTruthy()
    expect(screen.getByText(/xAI lists one context size per model; it is used as the max input/)).toBeTruthy()
    // The OpenAI and Claude rules still read "above".
    expect(rows.find((r) => r[0]!.startsWith('GPT-5.6 Sol'))![5]).toBe('>272K: in 2×, out 1.5×')
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

  it('has the site nav with Sources as the current page and a link back to the calculator', () => {
    render(<SourcesPage />)
    const nav = within(within(screen.getByRole('contentinfo')).getByRole('navigation', { name: 'Site' }))
    const back = nav.getByRole('link', { name: 'Calculator' })
    expect(back.getAttribute('href')).toBe('/')
    expect(back.getAttribute('target')).toBeNull()
    expect(nav.getByText('Sources').getAttribute('aria-current')).toBe('page')
    expect(nav.queryByRole('link', { name: 'Sources' })).toBeNull()
    expect(screen.getByRole('link', { name: 'calculator' }).getAttribute('href')).toBe('/')
  })
})

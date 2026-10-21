import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOCS, MODELS, PRICES_CHECKED } from '../data/pricing'
import { SourcesPage } from './SourcesPage'

const at = (iso: string) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(`${iso}T12:00:00Z`)) }
afterEach(() => vi.useRealTimers())
const upcoming = () => [...document.querySelectorAll('li.upcoming > ul > li')].map((li) => li.textContent)
const priceCells = (id: string) => { const r = [...document.querySelectorAll('table.sources tbody tr')].find((tr) => tr.textContent!.includes(`(${id})`))!; return [1, 2, 3].map((i) => r.children[i].textContent) }

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
    expect(xai[0]).toEqual(['Grok 4.7 (grok-4.7)', '$2', '$0.5 (0.25×)', '$6', 'auto 1×', '≥200K: in 2×, out 2×', '500K', 'low medium high* xhigh', 'kept dropped', '—', 'pricing'])
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

  it('lists the five Gemini models with model-page links, the 200K rule on 3.1 Pro, and the Google notes', () => {
    render(<SourcesPage />)
    const trs = [...document.querySelectorAll('table.sources tbody tr')].filter((r) => r.textContent!.includes('Gemini'))
    const rows = trs.map((r) => [...r.children].map((c) => c.textContent))
    expect(rows.map((r) => r[0])).toEqual([
      'Gemini 4 Argon (gemini-4-argon)', 'Gemini 3.8 Flash (gemini-3.8-flash)', 'Gemini 3.6 Flash (gemini-3.6-flash)',
      'Gemini 3.5 Flash-Lite (gemini-3.5-flash-lite)', 'Gemini 3.1 Pro Preview (gemini-3.1-pro-preview)',
    ])
    expect(rows[0]).toEqual(['Gemini 4 Argon (gemini-4-argon)', '$2', '$0.1 (0.05×)', '$10', 'implicit 1×', '—', '1.05M', 'low medium* high', 'kept*', '—', 'model page'])
    // The explicit cache storage price per hour: not on Argon, $0.5 on the Flash models (until 2027), $1 on Flash-Lite, $4.5 on 3.1 Pro.
    expect(rows.map((r) => r[9])).toEqual(['—', '$0.5/h', '$0.5/h', '$1/h', '$4.5/h'])
    expect(rows[3][7]).toBe('low medium high')
    expect(rows[4][5]).toBe('>200K: in 2×, out 1.5×')
    expect(rows[4][7]).toBe('low medium high*')
    expect(trs.map((r) => r.querySelector('a')!.getAttribute('href'))).toEqual(
      ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview'].map((id) => `https://ai.google.dev/gemini-api/docs/models/${id}`),
    )
    expect(screen.getByText(/Gemini 3\.x can also keep the fixed prompt in an explicit cache \(generateContent only, not the Interactions API; not Gemini 4 Argon\)/)).toBeTruthy()
    expect(screen.getByText(/Creating the cache is assumed to cost the standard input price: Google Cloud's docs say so, the Gemini API docs don't state it/)).toBeTruthy()
    expect(screen.getByText("Gemini's `minimal` thinking level isn't offered here, so Gemini 3.5 Flash-Lite, whose default is minimal, has no default marked and falls back to low.")).toBeTruthy()
    expect(screen.getByText('Not included: Gemini 2.5 models (access limited to earlier users), Gemini 3 Flash Preview and Gemini 3.1 Flash-Lite (not checked).')).toBeTruthy()
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

  it('before both announced dates: the table shows today\'s prices and both upcoming changes are listed', () => {
    at('2026-10-21')
    render(<SourcesPage />)
    expect(priceCells('gemini-4-argon')).toEqual(['$2', '$0.1 (0.05×)', '$10'])
    expect(priceCells('gemini-3.8-flash')).toEqual(['$0.75', '$0.075 (0.1×)', '$3.75'])
    expect(upcoming()).toEqual([
      'Gemini 4 Argon: $4.00 / $0.20 / $20.00 from 2026-12-01',
      'Gemini 3.8 Flash and Gemini 3.6 Flash: $1.50 / $0.15 / $7.50 from 2027-01-01 (explicit cache storage $1.00 per million tokens per hour)',
    ])
    expect(screen.getByText(/the table shows the prices in force today, 2026-10-21/)).toBeTruthy()
  })

  it('on the day of the first change: Argon is in the table at its new price and only the Flash change is upcoming', () => {
    at('2026-12-01')
    render(<SourcesPage />)
    expect(priceCells('gemini-4-argon')).toEqual(['$4', '$0.2 (0.05×)', '$20'])
    expect(priceCells('gemini-3.6-flash')).toEqual(['$0.75', '$0.075 (0.1×)', '$3.75'])
    expect(upcoming()).toEqual(['Gemini 3.8 Flash and Gemini 3.6 Flash: $1.50 / $0.15 / $7.50 from 2027-01-01 (explicit cache storage $1.00 per million tokens per hour)'])
  })

  it('between the two dates the same, and on 2026-11-30 the Argon change is still upcoming', () => {
    at('2026-12-31')
    const { unmount } = render(<SourcesPage />)
    expect(priceCells('gemini-4-argon')).toEqual(['$4', '$0.2 (0.05×)', '$20'])
    expect(upcoming()).toHaveLength(1)
    unmount()
    at('2026-11-30')
    render(<SourcesPage />)
    expect(priceCells('gemini-4-argon')).toEqual(['$2', '$0.1 (0.05×)', '$10'])
    expect(upcoming()).toHaveLength(2)
  })

  it('after both dates: all Google prices are the new ones and no upcoming note is shown at all', () => {
    at('2027-01-01')
    render(<SourcesPage />)
    expect(priceCells('gemini-4-argon')).toEqual(['$4', '$0.2 (0.05×)', '$20'])
    expect(priceCells('gemini-3.8-flash')).toEqual(['$1.5', '$0.15 (0.1×)', '$7.5'])
    expect(priceCells('gemini-3.6-flash')).toEqual(['$1.5', '$0.15 (0.1×)', '$7.5'])
    expect(priceCells('gemini-3.5-flash-lite')).toEqual(['$0.3', '$0.03 (0.1×)', '$2.5'])
    expect(document.querySelector('li.upcoming')).toBeNull()
    expect(screen.queryByText(/Announced price changes/)).toBeNull()
  })

  it('models without a schedule show the same prices on every date', () => {
    at('2026-10-21')
    const { unmount } = render(<SourcesPage />)
    const early = priceCells('claude-opus-5-5')
    unmount()
    at('2027-06-01')
    render(<SourcesPage />)
    expect(priceCells('claude-opus-5-5')).toEqual(early)
  })
})

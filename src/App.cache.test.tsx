import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { CACHE_INFO, EXPLICIT_BREAK_NOTE, EXPLICIT_CHECKBOX_NOTE, EXPLICIT_HOURS_NOTE, EXPLICIT_UNAVAILABLE_NOTE } from './data/cacheNotes'
import { MODELS } from './data/pricing'
import { mockMatchMedia } from './test-matchmedia'
import { stat } from './test-summary'

vi.mock('./components/CostChart', async () => ({ CostChart: (await import('./test-chart-mock')).CostChartMock }))

beforeEach(() => mockMatchMedia(true))

const box = () => within(screen.getByRole('group', { name: 'Setup C', hidden: true }))
const body = () => document.getElementById('setup-C-body')!
/** Puts Setup C on a model of any provider: the provider radio first, then the model select. */
function useModel(provider: string, model: string) {
  fireEvent.click(document.getElementById('setup-C-toggle')!)
  fireEvent.click(body().querySelector<HTMLInputElement>(`#provider-C-${provider}`)!)
  fireEvent.change(body().querySelector<HTMLSelectElement>('select[name=model]')!, { target: { value: model } })
}
const labelled = (label: string) => box().getByLabelText(label)
const noteOf = (el: HTMLElement) => document.getElementById(el.getAttribute('aria-describedby')!)!.textContent
const breaksNote = () => noteOf(box().getByLabelText('Cache breaking interruptions'))

describe('the cache field follows the provider and model', () => {
  it('Claude: "Cache lifetime" is a select, and its note and the interruptions note follow the option', () => {
    render(<App />)
    fireEvent.click(document.getElementById('setup-C-toggle')!)
    const select = labelled('Cache lifetime') as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    expect([...select.options].map((o) => o.textContent)).toEqual(['5 min · write 1.25×', '1 hour · write 2×'])
    expect(noteOf(select)).toBe('You set the lifetime; each hit restarts it. Writes cost 1.25× input.')
    expect(breaksNote()).toBe('Pauses longer than 5 min.')
    fireEvent.change(select, { target: { value: '1h' } })
    expect(noteOf(labelled('Cache lifetime'))).toBe('Survives pauses up to an hour. Writes cost 2× input.')
    expect(breaksNote()).toBe('Pauses longer than 1 hour.')
  })

  it('OpenAI GPT-5.6 and later: "Cache lifetime" is a read-only "30 min (fixed)", with its note', () => {
    render(<App />)
    useModel('openai', 'gpt-5.6-sol')
    const value = labelled('Cache lifetime')
    expect(value.textContent).toBe('30 min (fixed)')
    expect(value.getAttribute('role')).toBe('group')
    expect(value.tagName).not.toBe('SELECT')
    expect(value.hasAttribute('tabindex')).toBe(false)
    expect(noteOf(value)).toBe("Automatic. Kept at least 30 min after last use; can't be changed. Writes cost 1.25× input.")
    expect(breaksNote()).toBe('Pauses longer than 30 min.')
    expect(box().queryByRole('combobox', { name: 'Cache lifetime' })).toBeNull()
  })

  it('older OpenAI with two options (gpt-5.4): "Cache retention" is a select of 24h and in_memory, each with its note', () => {
    render(<App />)
    useModel('openai', 'gpt-5.4')
    const select = labelled('Cache retention') as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    expect([...select.options].map((o) => o.textContent)).toEqual(['24h', 'in_memory'])
    expect(noteOf(select)).toBe('Automatic, best-effort: usually about 30 min, up to 24 h. No write fee.')
    expect(breaksNote()).toBe("Any pause after which the cache is gone; when isn't predictable.")
    fireEvent.change(select, { target: { value: 'in_memory' } })
    expect(noteOf(labelled('Cache retention'))).toBe('Automatic, best-effort: usually 5–10 min idle, up to 1 h. No write fee.')
    expect(breaksNote()).toBe("Any pause after which the cache is gone; when isn't predictable.")
  })

  it('older OpenAI with one option is read-only: gpt-5.5 shows "24h", gpt-5.4-mini "in_memory", with the same notes', () => {
    render(<App />)
    useModel('openai', 'gpt-5.5')
    expect(labelled('Cache retention').textContent).toBe('24h')
    expect(noteOf(labelled('Cache retention'))).toBe('Automatic, best-effort: usually about 30 min, up to 24 h. No write fee.')
    fireEvent.change(body().querySelector<HTMLSelectElement>('select[name=model]')!, { target: { value: 'gpt-5.4-mini' } })
    expect(labelled('Cache retention').textContent).toBe('in_memory')
    expect(noteOf(labelled('Cache retention'))).toBe('Automatic, best-effort: usually 5–10 min idle, up to 1 h. No write fee.')
  })

  it('xAI: "Cache" reads "Automatic"; Google: "Cache" reads "Implicit (automatic)"; each with its note', () => {
    render(<App />)
    useModel('xai', 'grok-4.7')
    expect(labelled('Cache').textContent).toBe('Automatic')
    expect(noteOf(labelled('Cache'))).toBe('Best-effort, no lifetime setting; entries can be evicted at any time. No write fee.')
    expect(breaksNote()).toBe("Any pause after which the cache is gone; when isn't predictable.")
    useModel('google', 'gemini-3.8-flash')
    expect(labelled('Cache').textContent).toBe('Implicit (automatic)')
    expect(noteOf(labelled('Cache'))).toBe('Best-effort, no lifetime setting or guarantee. No write fee.')
  })

  it('one rule for every model: a single cache option is read-only, several make a select; labels and notes come from one map', () => {
    render(<App />)
    fireEvent.click(document.getElementById('setup-C-toggle')!)
    for (const [id, m] of Object.entries(MODELS)) {
      fireEvent.click(body().querySelector<HTMLInputElement>(`#provider-C-${m.provider}`)!)
      fireEvent.change(body().querySelector<HTMLSelectElement>('select[name=model]')!, { target: { value: id } })
      const info = CACHE_INFO[m.cache[0].id]
      const control = labelled(info.label)
      expect(control.tagName === 'SELECT', id).toBe(m.cache.length > 1)
      expect(noteOf(control), id).toBe(info.note)
      if (m.cache.length === 1) expect(control.textContent, id).toBe(info.fixedValue)
    }
  })

  it('keeps the help tip on the label, read-only or not, and the value box adds no tab stop', () => {
    render(<App />)
    useModel('xai', 'grok-4.7')
    expect(box().getByRole('button', { name: 'About Cache', hidden: true })).toBeTruthy()
    const focusable = body().querySelectorAll('select, input, button, [tabindex]:not([tabindex="-1"])')
    expect([...focusable].some((el) => el.id.endsWith('-cache'))).toBe(false)
  })
})

describe("Google's explicit cache", () => {
  it('the checkbox is on the Gemini 3.x models and off by default, with its note; Argon says it is not available', () => {
    render(<App />)
    useModel('google', 'gemini-3.1-pro-preview')
    const check = labelled('Explicit cache for prompt + tools') as HTMLInputElement
    expect([check.type, check.checked]).toEqual(['checkbox', false])
    expect(noteOf(check)).toBe(EXPLICIT_CHECKBOX_NOTE)
    expect(box().queryByLabelText('Session duration (hours)')).toBeNull()
    for (const id of ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']) {
      fireEvent.change(body().querySelector<HTMLSelectElement>('select[name=model]')!, { target: { value: id } })
      expect(box().getByLabelText('Explicit cache for prompt + tools'), id).toBeTruthy()
    }
    fireEvent.change(body().querySelector<HTMLSelectElement>('select[name=model]')!, { target: { value: 'gemini-4-argon' } })
    expect(box().queryByLabelText('Explicit cache for prompt + tools')).toBeNull()
    expect(screen.getAllByText(EXPLICIT_UNAVAILABLE_NOTE)).toHaveLength(1)
  })

  it('no other provider shows the checkbox or the unavailable note', () => {
    render(<App />)
    expect(document.querySelector('input[name=explicit]')).toBeNull()
    expect(screen.queryByText(EXPLICIT_UNAVAILABLE_NOTE)).toBeNull()
    useModel('xai', 'grok-4.7')
    expect(document.querySelector('input[name=explicit]')).toBeNull()
    expect(screen.queryByText(EXPLICIT_UNAVAILABLE_NOTE)).toBeNull()
  })

  it('ticking it shows "Session duration (hours)" (default 2, 0.25 to 168 in steps of 0.25, with its note) and extends the interruptions note', () => {
    render(<App />)
    useModel('google', 'gemini-3.1-pro-preview')
    fireEvent.click(labelled('Explicit cache for prompt + tools'))
    const hours = labelled('Session duration (hours)') as HTMLInputElement
    expect([hours.value, hours.min, hours.max, hours.step]).toEqual(['2', '0.25', '168', '0.25'])
    expect(noteOf(hours)).toBe(EXPLICIT_HOURS_NOTE)
    expect(breaksNote()).toBe(`Any pause after which the cache is gone; when isn't predictable.${EXPLICIT_BREAK_NOTE}`)
    expect(box().getByRole('button', { name: 'About Session duration (hours)', hidden: true })).toBeTruthy()
    expect(stat('Setup C').sub).toBe('Gemini 3.1 Pro Preview · implicit + explicit cache (2 h) · no cache breaks')
    fireEvent.click(labelled('Explicit cache for prompt + tools'))
    expect(box().queryByLabelText('Session duration (hours)')).toBeNull()
    expect(breaksNote()).toBe("Any pause after which the cache is gone; when isn't predictable.")
    expect(stat('Setup C').sub).toBe('Gemini 3.1 Pro Preview · implicit cache · no cache breaks')
  })

  it('clamps the hours, keeps what was typed, and falls back to 2 when emptied', () => {
    render(<App />)
    useModel('google', 'gemini-3.1-pro-preview')
    fireEvent.click(labelled('Explicit cache for prompt + tools'))
    const hours = labelled('Session duration (hours)') as HTMLInputElement
    fireEvent.change(hours, { target: { value: '500' } })
    expect(hours.value).toBe('500')
    expect(stat('Setup C').sub).toContain('(168 h)')
    fireEvent.change(hours, { target: { value: '0.1' } })
    expect(stat('Setup C').sub).toContain('(0.25 h)')
    fireEvent.change(hours, { target: { value: '1.5' } })
    expect(stat('Setup C').sub).toContain('(1.5 h)')
    fireEvent.change(hours, { target: { value: '' } })
    expect(stat('Setup C').sub).toContain('(2 h)')
  })

  it('switching to a model without it (or another provider) turns it off; between Gemini 3.x models it stays', () => {
    render(<App />)
    useModel('google', 'gemini-3.1-pro-preview')
    fireEvent.click(labelled('Explicit cache for prompt + tools'))
    fireEvent.change(labelled('Session duration (hours)'), { target: { value: '6' } })
    fireEvent.change(body().querySelector<HTMLSelectElement>('select[name=model]')!, { target: { value: 'gemini-3.8-flash' } })
    expect((labelled('Explicit cache for prompt + tools') as HTMLInputElement).checked).toBe(true)
    expect((labelled('Session duration (hours)') as HTMLInputElement).value).toBe('6')
    fireEvent.change(body().querySelector<HTMLSelectElement>('select[name=model]')!, { target: { value: 'gemini-4-argon' } })
    expect(box().queryByLabelText('Session duration (hours)')).toBeNull()
    fireEvent.change(body().querySelector<HTMLSelectElement>('select[name=model]')!, { target: { value: 'gemini-3.8-flash' } })
    expect((labelled('Explicit cache for prompt + tools') as HTMLInputElement).checked).toBe(false)
  })

  it('the breakdown gets an "Explicit cache storage" column only while a setup uses it', () => {
    render(<App />)
    const headers = () => [...document.querySelectorAll('table')[0].querySelectorAll('thead th')].map((th) => th.textContent)
    expect(headers()).not.toContain('Explicit cache storage')
    useModel('google', 'gemini-3.1-pro-preview')
    expect(headers()).not.toContain('Explicit cache storage')
    fireEvent.click(labelled('Explicit cache for prompt + tools'))
    expect(headers()).toContain('Explicit cache storage')
    const rows = [...document.querySelectorAll('table')[0].querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.textContent))
    const col = headers().indexOf('Explicit cache storage')
    // 20K base tokens, 2 hours, $4.5 per million tokens per hour: $0.18.
    expect(rows.map((r) => r[col])).toEqual(['—', '—', '$0.18', '—'])
    expect(rows.every((r) => r.length === headers().length)).toBe(true)
    fireEvent.click(labelled('Explicit cache for prompt + tools'))
    expect(headers()).not.toContain('Explicit cache storage')
  })
})

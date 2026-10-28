import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockMatchMedia } from '../test-matchmedia'
import { stat } from '../test-summary'
import { KeepAlivePage } from './KeepAlivePage'

vi.mock('./KeepAliveChart', () => ({
  KeepAliveChart: ({ curve, stopAt }: { curve: { minutes: number }[]; stopAt: number }) => (
    <div data-testid="ka-chart" data-stop={stopAt} data-last={curve.at(-1)?.minutes} />
  ),
}))

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement
const story = () => document.querySelector('.story')!.textContent!

beforeEach(() => mockMatchMedia(true))

describe('Cache Keep-alive page', () => {
  it('starts on Opus 5.5 with the 5 min cache at 200K: 23 pings every 4.5 min keep it warm 1 h 49 min', () => {
    render(<KeepAlivePage />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('How long is a warm cache worth keeping?')
    expect(stat('Keep pinging for')).toEqual({ value: '1 h 49 min', sub: '23 pings, one every 4.5 min' })
    expect(stat('Break-even')).toEqual({ value: '23.8 pings', sub: 'cost as much as one cold re-write' })
    expect(stat('One ping')).toEqual({ value: '$0.040', sub: 'reads 200K at 0.05× input' })
    expect(stat('Cold re-write')).toEqual({ value: '$0.96', sub: 'extra on your next message' })
    expect(stat('Prolonging cost')).toEqual({ value: '$0.93', sub: '23 pings × $0.040' })
    expect(document.querySelector('.summary')!.getAttribute('data-count')).toBe('5')
    expect([...document.querySelectorAll('.summary dt')].map((d) => d.textContent)).toEqual(['Keep pinging for', 'Break-even', 'One ping', 'Prolonging cost', 'Cold re-write'])
    expect(screen.getByTestId('ka-chart').getAttribute('data-stop')).toBe(String(23 * 4.5 + 5))
    expect(story()).toContain('set prolongCount to 23.')
    expect((field('Cache lifetime') as HTMLSelectElement).value).toBe('5m')
  })

  it('context is a slider in 10K steps from 10K to the model\'s max input, its value shown beside it', () => {
    render(<KeepAlivePage />)
    const slider = field('Context so far') as HTMLInputElement
    expect([slider.type, slider.min, slider.max, slider.step, slider.value]).toEqual(['range', '10000', '1000000', '10000', '200000'])
    expect(slider.getAttribute('aria-valuetext')).toBe('200K tokens')
    fireEvent.change(slider, { target: { value: '400000' } })
    expect(document.querySelector('.slider output')!.textContent).toBe('400K')
    expect(stat('One ping').sub).toBe('reads 400K at 0.05× input')
  })

  it('a context beyond the next model\'s max input slides to that max, rounded down to a 10K step', () => {
    render(<KeepAlivePage />)
    fireEvent.change(field('Context so far'), { target: { value: '1000000' } })
    fireEvent.click(screen.getByLabelText('OpenAI'))
    const slider = field('Context so far') as HTMLInputElement
    expect([slider.max, slider.value]).toEqual(['920000', '920000'])
    expect(document.querySelector('.slider output')!.textContent).toBe('920K')
    expect(stat('One ping').sub).toBe('reads 920K at 0.05× input')
  })

  it('keeps the ping interval (4.5 min) and tokens (20 in, 10 out) behind a collapsed Advanced settings section', () => {
    render(<KeepAlivePage />)
    const toggle = screen.getByRole('button', { name: 'Advanced settings' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    const body = document.getElementById(toggle.getAttribute('aria-controls')!)!
    expect(body.hidden).toBe(true)
    expect([(field('Ping input tokens') as HTMLInputElement).value, (field('Ping output tokens') as HTMLInputElement).value]).toEqual(['20', '10'])
    for (const label of ['Ping every (min)', 'Ping input tokens', 'Ping output tokens']) expect(body.contains(field(label))).toBe(true)
    expect((field('Ping every (min)') as HTMLInputElement).value).toBe('4.5')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(body.hidden).toBe(false)
  })

  it('the interval buttons move by 30 s below 10 min and by a minute from 10 up', () => {
    render(<KeepAlivePage />)
    const interval = () => (field('Ping every (min)') as HTMLInputElement).value
    const press = (name: string) => fireEvent.click(screen.getByRole('button', { name: `${name} Ping every (min)` }))
    fireEvent.click(screen.getByRole('button', { name: 'Advanced settings' }))
    press('Decrease')
    expect(interval()).toBe('4')
    expect(stat('Keep pinging for').sub).toBe('23 pings, one every 4 min')
    fireEvent.change(field('Cache lifetime'), { target: { value: '1h' } })
    fireEvent.change(field('Ping every (min)'), { target: { value: '10' } })
    press('Decrease')
    expect(interval()).toBe('9.5')
    press('Increase')
    press('Increase')
    expect(interval()).toBe('11')
  })

  it('switching to the 1 hour cache resets the interval to 59 min, and the plugin count tops out at 24', () => {
    render(<KeepAlivePage />)
    fireEvent.change(field('Ping every (min)'), { target: { value: '2' } })
    fireEvent.change(field('Cache lifetime'), { target: { value: '1h' } })
    expect((field('Ping every (min)') as HTMLInputElement).value).toBe('59')
    expect(stat('Keep pinging for')).toEqual({ value: '38 h 22 min', sub: '38 pings, one every 59 min' })
    expect(story()).toContain('set prolongCount to 24, its maximum')
  })

  it('a lower chance of coming back cuts the break-even in proportion', () => {
    render(<KeepAlivePage />)
    fireEvent.change(field('Chance you come back'), { target: { value: '50' } })
    expect(stat('Break-even').value).toBe('11.9 pings')
    expect(stat('Cold re-write').sub).toBe('$0.48 at 50% chance')
  })

  it('chance of coming back is a slider from 0 to 100% in 5% steps, its value shown beside it', () => {
    render(<KeepAlivePage />)
    const slider = field('Chance you come back') as HTMLInputElement
    expect([slider.type, slider.min, slider.max, slider.step, slider.value]).toEqual(['range', '0', '100', '5', '100'])
    fireEvent.change(slider, { target: { value: '75' } })
    expect(slider.getAttribute('aria-valuetext')).toBe('75%')
    expect(document.querySelectorAll('.slider output')[1].textContent).toBe('75%')
  })

  it('offers only Claude and OpenAI, as a toggle: xAI and Google have no known cache lifetime', () => {
    render(<KeepAlivePage />)
    const toggle = within(screen.getByRole('radiogroup', { name: 'Provider' }))
    expect(toggle.getAllByRole('radio').map((r) => (r as HTMLInputElement).labels![0].textContent)).toEqual(['Claude', 'OpenAI'])
    expect((toggle.getByLabelText('Claude') as HTMLInputElement).checked).toBe(true)
  })

  it('on OpenAI: GPT-6.1 Sol first, only the 30 min cache models, the cache read-only, pings every 29 min, no plugin line', () => {
    render(<KeepAlivePage />)
    fireEvent.click(screen.getByLabelText('OpenAI'))
    expect((field('Model') as HTMLSelectElement).value).toBe('gpt-6.1-sol')
    expect([...(field('Model') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['GPT-6 Astra', 'GPT-6.1 Sol', 'GPT-6 Sol', 'GPT-6 Luna', 'GPT-5.6 Sol', 'GPT-5.6 Terra', 'GPT-5.6 Luna'])
    expect(screen.getByRole('group', { name: 'Cache lifetime' }).textContent).toBe('30 min (fixed)')
    expect((field('Ping every (min)') as HTMLInputElement).value).toBe('29')
    expect(story()).not.toContain('prolongCount')
  })

  it('lists only the caches with a known lifetime in the comparison table', () => {
    render(<KeepAlivePage />)
    const cells = [...document.querySelectorAll('table tbody tr td:nth-child(2)')].map((td) => td.textContent)
    expect(cells).toHaveLength(8 * 2 + 7)
    expect(new Set(cells)).toEqual(new Set(['5 min', '1 hour', '30 min (fixed)']))
    expect(document.querySelector('table')!.textContent).not.toMatch(/Grok|Gemini|GPT-5\.5|GPT-5\.4/)
  })
})

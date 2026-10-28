import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NumberField } from './NumberField'

const setup = (props: Partial<Parameters<typeof NumberField>[0]> = {}) => {
  const onChange = vi.fn()
  render(
    <NumberField label="Amount" help="tip" name="amount" min={500} max={200000} step={500} fallback={5000} value={5000} onChange={onChange} {...props} />,
  )
  return { onChange, input: screen.getByLabelText('Amount') as HTMLInputElement }
}
const K = { scale: 1000 } as const

describe('NumberField without a scale', () => {
  it('shows the value and reports the clamped typed number, as before', () => {
    const { onChange, input } = setup()
    expect([input.value, input.min, input.max, input.step]).toEqual(['5000', '500', '200000', '500'])
    fireEvent.change(input, { target: { value: '700' } })
    expect(onChange).toHaveBeenLastCalledWith(700)
    fireEvent.change(input, { target: { value: '1' } })
    expect(onChange).toHaveBeenLastCalledWith(500)
    fireEvent.change(input, { target: { value: '9999999' } })
    expect(onChange).toHaveBeenLastCalledWith(200000)
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(5000)
  })
})

describe('NumberField in thousands (scale 1000)', () => {
  it('shows the stored value divided by 1000 and gives min, max and step in thousands', () => {
    const { input } = setup({ ...K })
    expect([input.value, input.min, input.max, input.step]).toEqual(['5', '0.5', '200', '0.5'])
  })

  it.each([
    [1000000, '1000'], [20000, '20'], [500, '0.5'], [0, '0'], [300, '0.3'], [2500, '2.5'], [100, '0.1'],
    [300.00000000000006, '0.3'], [1234, '1.234'], [1234.5678, '1.235'], [10000, '10'],
  ])('displays %s tokens as "%s", without float noise or trailing zeros', (tokens, shown) => {
    const { input } = setup({ ...K, min: 0, value: tokens })
    expect(input.value).toBe(shown)
  })

  it('stores typed thousands as whole tokens', () => {
    const { onChange, input } = setup({ ...K, min: 0 })
    fireEvent.change(input, { target: { value: '0.3' } })
    expect(onChange).toHaveBeenLastCalledWith(300)
    fireEvent.change(input, { target: { value: '12.5' } })
    expect(onChange).toHaveBeenLastCalledWith(12500)
    fireEvent.change(input, { target: { value: '1.2345' } })
    expect(onChange).toHaveBeenLastCalledWith(1235)
    fireEvent.change(input, { target: { value: '0.1' } })
    expect(onChange).toHaveBeenLastCalledWith(100)
  })

  it('rounds below one token with Math.round: 0.0005 is 1, 0.0004 is 0', () => {
    const { onChange, input } = setup({ ...K, min: 0 })
    fireEvent.change(input, { target: { value: '0.0005' } })
    expect(onChange).toHaveBeenLastCalledWith(1)
    fireEvent.change(input, { target: { value: '0.0004' } })
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('clamps in tokens against min and max', () => {
    const { onChange, input } = setup({ ...K })
    fireEvent.change(input, { target: { value: '0.1' } })
    expect(onChange).toHaveBeenLastCalledWith(500)
    fireEvent.change(input, { target: { value: '-3' } })
    expect(onChange).toHaveBeenLastCalledWith(500)
    fireEvent.change(input, { target: { value: '5000' } })
    expect(onChange).toHaveBeenLastCalledWith(200000)
  })

  it('falls back (in tokens) when empty or not a number, and keeps showing what was typed', () => {
    const { onChange, input } = setup({ ...K, fallback: 20000 })
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(20000)
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(onChange).toHaveBeenLastCalledWith(20000)
    fireEvent.change(input, { target: { value: '3.7' } })
    expect(input.value).toBe('3.7')
    expect(onChange).toHaveBeenLastCalledWith(3700)
  })
})

describe('NumberField minus and plus buttons', () => {
  const inc = () => screen.getByRole('button', { name: 'Increase Amount' }) as HTMLButtonElement
  const dec = () => screen.getByRole('button', { name: 'Decrease Amount' }) as HTMLButtonElement
  const BIG = { ...K, min: 10000, max: 1000000, step: 10000, clickStep: 50000, value: 995000 }

  it('has two type=button controls labelled with the field, showing the minus sign and plus', () => {
    setup()
    expect([inc().type, dec().type, inc().textContent, dec().textContent]).toEqual(['button', 'button', '+', '\u2212'])
  })

  it('without clickStep it moves by step, snapped to its grid', () => {
    const { onChange, input } = setup({ value: 700 })
    fireEvent.click(inc())
    expect(onChange).toHaveBeenLastCalledWith(1000)
    expect(input.value).toBe('1000')
  })

  it('snaps up to the next multiple of the click step, and down to the one below', () => {
    const { onChange, input } = setup({ ...K, min: 0, step: 100, clickStep: 500, value: 300 })
    fireEvent.click(inc())
    expect(onChange).toHaveBeenLastCalledWith(500)
    expect(input.value).toBe('0.5')
  })

  it('snaps down from off-grid and from on-grid values', () => {
    const { onChange } = setup({ ...K, min: 0, step: 100, clickStep: 500, value: 700 })
    fireEvent.click(dec())
    expect(onChange).toHaveBeenLastCalledWith(500)
  })

  it('moves by one grid step from a value on the grid (1000K minus is 950K, shown in K)', () => {
    const { onChange, input } = setup({ ...BIG, value: 1000000 })
    fireEvent.click(dec())
    expect(onChange).toHaveBeenLastCalledWith(950000)
    expect(input.value).toBe('950')
  })

  it('clamps to min and max (50K minus lands on the 10K minimum)', () => {
    const { onChange, input } = setup({ ...BIG, value: 50000 })
    fireEvent.click(dec())
    expect(onChange).toHaveBeenLastCalledWith(10000)
    expect(input.value).toBe('10')
  })

  it('clamps up to max too', () => {
    const { onChange } = setup({ ...BIG, value: 980000 })
    fireEvent.click(inc())
    expect(onChange).toHaveBeenLastCalledWith(1000000)
  })

  it('carries no float noise with 0.1K steps', () => {
    const { onChange, input } = setup({ ...K, min: 0, step: 100, clickStep: 100, value: 300 })
    fireEvent.click(inc())
    expect(onChange).toHaveBeenLastCalledWith(400)
    expect(input.value).toBe('0.4')
  })

  it('moves a half-hour field up by 0.5 from the 0.25 minimum, and down from 2', () => {
    const hours = { min: 0.25, max: 168, step: 0.25, clickStep: 0.5, fallback: 2 }
    const { onChange, input } = setup({ ...hours, value: 0.25 })
    fireEvent.click(inc())
    expect(onChange).toHaveBeenLastCalledWith(0.5)
    expect(input.value).toBe('0.5')
  })

  it('moves a half-hour field down by 0.5 from 2', () => {
    const { onChange, input } = setup({ min: 0.25, max: 168, step: 0.25, clickStep: 0.5, fallback: 2, value: 2 })
    fireEvent.click(dec())
    expect(onChange).toHaveBeenLastCalledWith(1.5)
    expect(input.value).toBe('1.5')
  })

  it('moves a half-hour field off the grid: 2.25 up is 2.5, down is 2', () => {
    const hours = { min: 0.25, max: 168, step: 0.25, clickStep: 0.5, fallback: 2 }
    const { onChange } = setup({ ...hours, value: 2.25 })
    fireEvent.click(inc())
    expect(onChange).toHaveBeenLastCalledWith(2.5)
    fireEvent.click(dec())
    expect(onChange).toHaveBeenLastCalledWith(2)
  })

  it('disables minus at the minimum and plus at the maximum', () => {
    setup({ value: 500 })
    expect([dec().disabled, inc().disabled]).toEqual([true, false])
  })

  it('disables plus at the maximum', () => {
    setup({ value: 200000 })
    expect([dec().disabled, inc().disabled]).toEqual([false, true])
  })

  it('typing still works after clicking, and an empty input falls back', () => {
    const { onChange, input } = setup()
    fireEvent.click(inc())
    expect(input.value).toBe('5500')
    fireEvent.change(input, { target: { value: '700' } })
    expect(onChange).toHaveBeenLastCalledWith(700)
    expect(input.value).toBe('700')
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(5000)
  })
})

describe('NumberField with a click step that depends on the value', () => {
  // 30 s below 10 min, a whole minute from 10 up: − from 10 lands on 9.5, + from 9.5 on 10.
  const halfBelowTen = (value: number, dir: 1 | -1) => ((dir === 1 ? value < 10 : value <= 10) ? 0.5 : 1)
  const minutes = { min: 1, max: 60, step: 0.5, clickStep: halfBelowTen, fallback: 4.5 } as const
  const press = (name: string) => fireEvent.click(screen.getByRole('button', { name: `${name} Amount` }))

  it.each([
    [4.5, 'Increase', 5], [4.5, 'Decrease', 4], [9.5, 'Increase', 10], [10, 'Decrease', 9.5],
    [10, 'Increase', 11], [59, 'Decrease', 58], [4.25, 'Increase', 4.5],
  ] as const)('from %s, %s moves to %s', (value, button, next) => {
    const { onChange, input } = setup({ ...minutes, value })
    press(button)
    expect(onChange).toHaveBeenLastCalledWith(next)
    expect(input.value).toBe(String(next))
  })
})

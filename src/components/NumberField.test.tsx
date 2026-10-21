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

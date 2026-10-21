import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScrollRegion } from './ScrollRegion'

describe('ScrollRegion', () => {
  it('is focusable by script only and takes focus on load when nothing else has it', () => {
    const { container } = render(<ScrollRegion className="page-scroll"><p>content</p></ScrollRegion>)
    const region = container.firstElementChild as HTMLElement
    expect(region.getAttribute('tabindex')).toBe('-1')
    expect(region.className).toContain('scroll-region')
    expect(document.activeElement).toBe(region)
  })

  it('does not steal focus from a control that already has it', () => {
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    render(<ScrollRegion className="content"><p>content</p></ScrollRegion>)
    expect(document.activeElement).toBe(input)
    input.remove()
  })
})

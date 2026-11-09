import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ScrollReveal from './ScrollReveal'

describe('ScrollReveal', () => {
  it('renders its children', () => {
    render(<ScrollReveal>hello world</ScrollReveal>)
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('applies the reveal class and merges a custom className', () => {
    render(<ScrollReveal className="extra">content</ScrollReveal>)
    const el = screen.getByText('content')
    expect(el).toHaveClass('reveal')
    expect(el).toHaveClass('extra')
  })

  it('renders with a custom element via the `as` prop', () => {
    render(<ScrollReveal as="section">section content</ScrollReveal>)
    expect(screen.getByText('section content').tagName).toBe('SECTION')
  })
})

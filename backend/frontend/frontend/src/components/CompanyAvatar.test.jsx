import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CompanyAvatar from './CompanyAvatar'

describe('CompanyAvatar', () => {
  it('shows initials from up to two words of the name', () => {
    render(<CompanyAvatar name="Acme Corp" />)
    expect(screen.getByText('AC')).toBeInTheDocument()
  })

  it('shows a question mark with no name', () => {
    render(<CompanyAvatar />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('renders the same gradient for the same name', () => {
    const { container: a } = render(<CompanyAvatar name="Stripe" />)
    const { container: b } = render(<CompanyAvatar name="Stripe" />)
    expect(a.firstChild.getAttribute('style')).toBe(b.firstChild.getAttribute('style'))
  })

  it('honors the size prop', () => {
    const { container } = render(<CompanyAvatar name="Stripe" size={64} />)
    expect(container.firstChild.getAttribute('style')).toContain('width: 64px')
  })
})

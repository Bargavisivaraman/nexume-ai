import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ATSBreakdown from './ATSBreakdown'

const BREAKDOWN = {
  sections: { normalised_points: 24 },
  quantification: { points: 30 },
  action_verbs: { points: 10 },
  keywords: { points: 21 },
  length_format: { points: 12 },
  contact_info: { points: 3 },
}

describe('ATSBreakdown', () => {
  it('renders nothing without a breakdown', () => {
    const { container } = render(<ATSBreakdown breakdown={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a row per category with points over max', () => {
    render(<ATSBreakdown breakdown={BREAKDOWN} />)

    expect(screen.getByText('Score Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Resume Sections')).toBeInTheDocument()
    expect(screen.getByText('24/30')).toBeInTheDocument()
    expect(screen.getByText('30/30')).toBeInTheDocument()  // quantification maxed
    expect(screen.getByText('3/10')).toBeInTheDocument()   // weak contact info
  })

  it('tolerates missing categories by scoring them zero', () => {
    render(<ATSBreakdown breakdown={{}} />)
    expect(screen.getAllByText(/^0\//)).toHaveLength(6)
  })
})

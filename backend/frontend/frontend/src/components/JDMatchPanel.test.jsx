import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import JDMatchPanel from './JDMatchPanel'

const JD = {
  match_pct: 72,
  verdict: 'Moderate Match',
  verdict_color: 'yellow',
  matched_keywords: ['python', 'aws'],
  missing_keywords: ['kubernetes'],
  total_jd_keywords: 10,
  suggestions: ['Add Kubernetes to your skills section'],
}

describe('JDMatchPanel', () => {
  it('shows the match percentage, verdict, and keyword tally', () => {
    render(<JDMatchPanel jd={JD} />)

    expect(screen.getByText('72%')).toBeInTheDocument()
    expect(screen.getByText('Moderate Match')).toBeInTheDocument()
    expect(screen.getByText('2 of 10 job keywords found in your resume')).toBeInTheDocument()
  })

  it('renders matched and missing keyword chips and the quick wins', () => {
    render(<JDMatchPanel jd={JD} />)

    expect(screen.getByText('kubernetes')).toHaveClass('chip-missing')
    expect(screen.getByText('python')).toHaveClass('chip-matched')
    expect(screen.getByText('Add Kubernetes to your skills section')).toBeInTheDocument()
  })

  it('hides empty sections', () => {
    render(<JDMatchPanel jd={{ ...JD, missing_keywords: [], suggestions: [] }} />)

    expect(screen.queryByText('Missing Keywords')).not.toBeInTheDocument()
    expect(screen.queryByText('Quick Wins')).not.toBeInTheDocument()
  })

  it('colors the verdict by band', () => {
    render(<JDMatchPanel jd={{ ...JD, verdict: 'Strong Match', verdict_color: 'green' }} />)
    expect(screen.getByText('Strong Match')).toHaveStyle({ color: '#30d158' })
  })
})

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import InterviewSimulator from './InterviewSimulator'

beforeEach(() => localStorage.clear())

function seedHistory(entries) {
  localStorage.setItem('nexume_interview_history', JSON.stringify(entries))
}

describe('InterviewSimulator past-mocks panel', () => {
  it('is hidden with no history', () => {
    render(<InterviewSimulator />)
    expect(screen.queryByText('Your past mocks')).not.toBeInTheDocument()
  })

  it('lists past mocks with role, company, and score', () => {
    seedHistory([
      { id: '1', mode: 'hr', role: 'Backend Engineer', company: 'Acme', date: 'Jul 20', overall: 82 },
      { id: '2', mode: 'technical', role: 'SRE', company: '', date: 'Jul 18', overall: 74 },
    ])

    render(<InterviewSimulator />)

    expect(screen.getByText('Your past mocks')).toBeInTheDocument()
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument()
    expect(screen.getByText(/Jul 20 · Acme/)).toBeInTheDocument()
    expect(screen.getByText('SRE')).toBeInTheDocument()
  })

  it('shows the score trend against the previous mock', () => {
    // Newest first: 82 after 74 → up-trend of 8 on the newest entry
    seedHistory([
      { id: '1', mode: 'hr', role: 'A', date: 'Jul 20', overall: 82 },
      { id: '2', mode: 'hr', role: 'B', date: 'Jul 18', overall: 74 },
    ])

    render(<InterviewSimulator />)

    expect(screen.getByText(/▲8/)).toBeInTheDocument()
  })
})

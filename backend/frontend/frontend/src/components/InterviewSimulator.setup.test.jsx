import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import InterviewSimulator from './InterviewSimulator'
import { MODES, VOICES } from '../lib/interviewConfig'

beforeEach(() => localStorage.clear())

describe('InterviewSimulator setup screen', () => {
  it('renders every interview mode and voice option', () => {
    render(<InterviewSimulator />)

    for (const m of MODES) {
      expect(screen.getByText(m.label)).toBeInTheDocument()
    }
    for (const v of VOICES) {
      expect(screen.getByText(v.label)).toBeInTheDocument()
    }
  })

  it('prefills the target role and company from props', () => {
    render(<InterviewSimulator prefillTitle="Staff Engineer" prefillCompany="Acme" />)

    expect(screen.getByPlaceholderText(/Senior Frontend Engineer/)).toHaveValue('Staff Engineer')
    expect(screen.getByPlaceholderText(/Stripe/)).toHaveValue('Acme')
  })

  it('switches the selected mode on click', async () => {
    const user = userEvent.setup()
    render(<InterviewSimulator />)

    const technical = screen.getByText('Technical').closest('button')
    await user.click(technical)

    expect(technical.className).toContain('active')
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MajorPicker from './MajorPicker'
import { MAJORS } from '../data/majors'

describe('MajorPicker', () => {
  it('shows the placeholder trigger when nothing is selected', () => {
    render(<MajorPicker value={null} onChange={() => {}} />)
    expect(screen.getByText('Pick your major')).toBeInTheDocument()
  })

  it('shows the selected major label', () => {
    const first = MAJORS[0]
    render(<MajorPicker value={first.id} onChange={() => {}} />)
    expect(screen.getByText(first.label)).toBeInTheDocument()
  })

  it('opens the popover and picks a major', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MajorPicker value={null} onChange={onChange} />)

    await user.click(screen.getByText('Pick your major'))
    const target = MAJORS[0]
    await user.click(screen.getByRole('button', { name: new RegExp(target.label) }))

    expect(onChange).toHaveBeenCalledWith(target.id)
  })

  it('finds a major by searching one of its role labels', async () => {
    const user = userEvent.setup()
    render(<MajorPicker value={null} onChange={() => {}} />)

    const major = MAJORS.find((m) => m.roles.length > 0)
    await user.click(screen.getByText('Pick your major'))
    await user.type(screen.getByPlaceholderText(/Search .* majors/), major.roles[0].label)

    expect(screen.getByText(/match/)).toBeInTheDocument()
  })

  it('clears the selection via the × control', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MajorPicker value={MAJORS[0].id} onChange={onChange} />)

    await user.click(screen.getByText('×'))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})

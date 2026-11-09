import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import RolesStrip from './RolesStrip'
import { MAJORS } from '../data/majors'

const major = MAJORS[0]

describe('RolesStrip', () => {
  it('renders nothing without a major', () => {
    const { container } = render(
      <RolesStrip majorId={null} activeRoleId={null} onPickRole={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a pill for each role of the major', () => {
    render(<RolesStrip majorId={major.id} activeRoleId={null} onPickRole={() => {}} />)
    expect(screen.getByText(major.label)).toBeInTheDocument()
    expect(screen.getByText(major.roles[0].label)).toBeInTheDocument()
  })

  it('selects a role on click and toggles it off on the second click', async () => {
    const user = userEvent.setup()
    const onPickRole = vi.fn()
    const role = major.roles[0]

    const { rerender } = render(
      <RolesStrip majorId={major.id} activeRoleId={null} onPickRole={onPickRole} />,
    )
    await user.click(screen.getByText(role.label))
    expect(onPickRole).toHaveBeenCalledWith(role.id)

    rerender(<RolesStrip majorId={major.id} activeRoleId={role.id} onPickRole={onPickRole} />)
    await user.click(screen.getByText(role.label))
    expect(onPickRole).toHaveBeenLastCalledWith(null)
  })
})

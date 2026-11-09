import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SectorPicker from './SectorPicker'
import { SECTORS } from '../data/sectors'

describe('SectorPicker', () => {
  it('shows the placeholder trigger when nothing is selected', () => {
    render(<SectorPicker value={null} onChange={() => {}} />)
    expect(screen.getByText('Pick a sector')).toBeInTheDocument()
  })

  it('shows the selected sector label', () => {
    const first = SECTORS[0]
    render(<SectorPicker value={first.id} onChange={() => {}} />)
    expect(screen.getByText(first.label)).toBeInTheDocument()
  })

  it('opens the popover and picks a sector', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SectorPicker value={null} onChange={onChange} />)

    await user.click(screen.getByText('Pick a sector'))
    const target = SECTORS[0]
    await user.click(screen.getByRole('button', { name: new RegExp(target.label) }))

    expect(onChange).toHaveBeenCalledWith(target.id)
  })

  it('filters sectors by search query', async () => {
    const user = userEvent.setup()
    render(<SectorPicker value={null} onChange={() => {}} />)

    await user.click(screen.getByText('Pick a sector'))
    await user.type(screen.getByPlaceholderText(/Search 100\+ sectors/), 'machine learning')

    expect(screen.getByText(/match/)).toBeInTheDocument()
    expect(screen.getByText('AI / Machine Learning')).toBeInTheDocument()
  })

  it('clears the selection via the × control', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SectorPicker value={SECTORS[0].id} onChange={onChange} />)

    await user.click(screen.getByText('×'))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})

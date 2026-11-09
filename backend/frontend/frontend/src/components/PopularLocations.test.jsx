import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PopularLocations from './PopularLocations'
import { POPULAR_LOCATIONS } from '../data/locations'

describe('PopularLocations', () => {
  it('renders a pill per popular location', () => {
    render(<PopularLocations activeValue={null} onPick={() => {}} />)
    for (const loc of POPULAR_LOCATIONS.slice(0, 3)) {
      expect(screen.getByText(loc.label)).toBeInTheDocument()
    }
  })

  it('passes the full location object to onPick', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<PopularLocations activeValue={null} onPick={onPick} />)

    await user.click(screen.getByText(POPULAR_LOCATIONS[0].label))
    expect(onPick).toHaveBeenCalledWith(POPULAR_LOCATIONS[0])
  })

  it('marks the active location pill', () => {
    const loc = POPULAR_LOCATIONS[0]
    render(<PopularLocations activeValue={loc.value} onPick={() => {}} />)
    expect(screen.getByText(loc.label).closest('button')).toHaveClass('active')
  })
})

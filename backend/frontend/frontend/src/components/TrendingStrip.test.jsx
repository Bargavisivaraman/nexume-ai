import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TrendingStrip from './TrendingStrip'
import { SECTOR_BY_ID, TRENDING_SECTORS } from '../data/sectors'

const firstTrending = SECTOR_BY_ID[TRENDING_SECTORS[0]]

describe('TrendingStrip', () => {
  it('renders a pill for each trending sector', () => {
    render(<TrendingStrip active={null} onPick={() => {}} />)
    expect(screen.getByText('Trending now')).toBeInTheDocument()
    expect(screen.getByText(firstTrending.label)).toBeInTheDocument()
  })

  it('selects a sector on click and toggles it off when already active', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()

    const { rerender } = render(<TrendingStrip active={null} onPick={onPick} />)
    await user.click(screen.getByText(firstTrending.label))
    expect(onPick).toHaveBeenCalledWith(firstTrending.id)

    rerender(<TrendingStrip active={firstTrending.id} onPick={onPick} />)
    await user.click(screen.getByText(firstTrending.label))
    expect(onPick).toHaveBeenLastCalledWith(null)
  })
})

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SkeletonJobCard from './SkeletonJobCard'

describe('SkeletonJobCard', () => {
  it('renders the skeleton card with placeholder lines', () => {
    const { container } = render(<SkeletonJobCard />)
    expect(container.querySelector('.skeleton-card')).not.toBeNull()
    expect(container.querySelectorAll('.skeleton-line').length).toBeGreaterThanOrEqual(6)
  })
})

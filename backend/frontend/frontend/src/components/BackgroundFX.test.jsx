import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import BackgroundFX from './BackgroundFX'

describe('BackgroundFX', () => {
  it('renders three orbs and the mouse-glow layer without crashing', () => {
    const { container } = render(<BackgroundFX />)
    expect(container.querySelectorAll('.orb')).toHaveLength(3)
    expect(container.querySelector('.mouse-glow')).not.toBeNull()
    expect(container.querySelector('.orbs-wrap')).not.toBeNull()
  })
})

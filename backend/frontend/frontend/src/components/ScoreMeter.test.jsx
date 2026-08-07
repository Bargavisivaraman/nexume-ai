import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ScoreMeter from './ScoreMeter'

function ringColor(container) {
  return container.querySelectorAll('circle')[1].getAttribute('stroke')
}

describe('ScoreMeter', () => {
  it('shows the score and label', () => {
    render(<ScoreMeter score={82} />)
    expect(screen.getByText('82')).toBeInTheDocument()
    expect(screen.getByText('ATS Score')).toBeInTheDocument()
  })

  it('colors the ring by band: green ≥75, yellow ≥50, red below', () => {
    expect(ringColor(render(<ScoreMeter score={75} />).container)).toBe('#30d158')
    expect(ringColor(render(<ScoreMeter score={50} />).container)).toBe('#ffd60a')
    expect(ringColor(render(<ScoreMeter score={49} />).container)).toBe('#ff453a')
  })
})

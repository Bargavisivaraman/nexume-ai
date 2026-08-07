import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SalaryRange from './SalaryRange'

describe('SalaryRange', () => {
  it('displays the current range, with 400k+ at the cap', () => {
    render(<SalaryRange value={[50000, 400000]} onChange={() => {}} />)
    expect(screen.getByText(/\$50k/)).toBeInTheDocument()
    expect(screen.getByText(/400k\+/)).toBeInTheDocument()
  })

  it('clamps the min handle below the max handle', () => {
    const onChange = vi.fn()
    const { container } = render(
      <SalaryRange value={[50000, 100000]} onChange={onChange} />,
    )
    // Try to drag min past max: it must clamp to max - 5000.
    fireEvent.change(container.querySelector('.salary-range-slider.min'), {
      target: { value: '200000' },
    })
    expect(onChange).toHaveBeenCalledWith([95000, 100000])
  })

  it('clamps the max handle above the min handle', () => {
    const onChange = vi.fn()
    const { container } = render(
      <SalaryRange value={[150000, 200000]} onChange={onChange} />,
    )
    fireEvent.change(container.querySelector('.salary-range-slider.max'), {
      target: { value: '100000' },
    })
    expect(onChange).toHaveBeenCalledWith([150000, 155000])
  })
})

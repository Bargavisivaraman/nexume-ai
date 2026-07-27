import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TabErrorBoundary from './TabErrorBoundary'

function Bomb({ explode }) {
  if (explode) throw new Error('kaboom')
  return <div>tab content</div>
}

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

describe('TabErrorBoundary', () => {
  it('renders its children when nothing crashes', () => {
    render(
      <TabErrorBoundary resetKey="jobs"><Bomb explode={false} /></TabErrorBoundary>,
    )
    expect(screen.getByText('tab content')).toBeInTheDocument()
  })

  it('catches a crash and shows the fallback instead of white-screening', () => {
    render(
      <TabErrorBoundary resetKey="jobs"><Bomb explode /></TabErrorBoundary>,
    )
    expect(screen.getByText('Something broke on this tab')).toBeInTheDocument()
    expect(screen.getByText('Refresh')).toBeInTheDocument()
  })

  it('clears the crash state when the resetKey (active tab) changes', () => {
    const { rerender } = render(
      <TabErrorBoundary resetKey="jobs"><Bomb explode /></TabErrorBoundary>,
    )
    expect(screen.getByText('Something broke on this tab')).toBeInTheDocument()

    rerender(
      <TabErrorBoundary resetKey="resume"><Bomb explode={false} /></TabErrorBoundary>,
    )
    expect(screen.getByText('tab content')).toBeInTheDocument()
  })
})

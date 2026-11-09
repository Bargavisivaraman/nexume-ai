import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JobsStatusBar from './JobsStatusBar'

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('JobsStatusBar', () => {
  it('shows a loading state before stats arrive', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))) // never resolves
    render(<JobsStatusBar />)
    expect(screen.getByText(/Loading job market status/i)).toBeInTheDocument()
  })

  it('renders the rounded job count and posted-today badge once stats load', async () => {
    const stats = { total_jobs: 1937, last_updated: new Date().toISOString(), posted_in_last_24h: 5 }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => stats })))

    render(<JobsStatusBar />)

    expect(await screen.findByText('1.9K+')).toBeInTheDocument()
    expect(screen.getByText(/5 posted today/)).toBeInTheDocument()
  })

  it('hides itself for non-admins when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))

    const { container } = render(<JobsStatusBar />)

    await waitFor(() => {
      expect(screen.queryByText(/Loading job market status/i)).not.toBeInTheDocument()
    })
    expect(container).toBeEmptyDOMElement()
  })
})

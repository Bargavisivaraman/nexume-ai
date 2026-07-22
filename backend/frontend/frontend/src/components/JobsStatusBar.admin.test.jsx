import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JobsStatusBar from './JobsStatusBar'

const STATS = {
  total_jobs: 1200,
  last_updated: new Date().toISOString(),
  posted_in_last_24h: 3,
  sources: { Greenhouse: 800, Lever: 400 },
  next_run: null,
  recent_runs: [{ id: 'r1', completed_at: new Date().toISOString(), country: 'US', fetched: 50, inserted: 40, errors: 0 }],
}

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => STATS })))
})
afterEach(() => vi.unstubAllGlobals())

describe('JobsStatusBar admin view', () => {
  it('offers no admin toggle to regular users', async () => {
    render(<JobsStatusBar />)
    await screen.findByText('1.2K+')
    expect(screen.queryByText(/Admin/)).not.toBeInTheDocument()
  })

  it('expands per-source counts and recent runs for admins', async () => {
    localStorage.setItem('nexume_admin', '1')
    const user = userEvent.setup()
    render(<JobsStatusBar />)

    await user.click(await screen.findByText(/▾ Admin/))

    expect(screen.getByText('Greenhouse')).toBeInTheDocument()
    expect(screen.getByText('800+')).toBeInTheDocument()
    expect(screen.getByText(/Recent fetch runs/)).toBeInTheDocument()
    expect(screen.getByText(/fetched/)).toBeInTheDocument()
  })
})

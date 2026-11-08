import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JobsTab from './JobsTab'

const JOB = {
  job_id: 'j1',
  title: 'Backend Engineer',
  company: 'Acme Inc',
  description: 'Design and run the API platform.',
  source: 'Greenhouse',
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (url) => ({
    ok: true,
    status: 200,
    json: async () => String(url).includes('/jobs/stats')
      ? { total_jobs: 1 }
      : { jobs: [JOB], has_more: false },
  })))
})
afterEach(() => vi.unstubAllGlobals())

describe('JobsTab card actions', () => {
  it('expands a card and fires the parent callbacks with the job', async () => {
    const onPrepInterview = vi.fn()
    const onCoverLetter = vi.fn()
    const user = userEvent.setup()
    render(<JobsTab onPrepInterview={onPrepInterview} onCoverLetter={onCoverLetter} />)

    // Clicking a card opens the detail drawer with the full description
    await user.click(await screen.findByText('Backend Engineer'))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText(/Design and run the API platform/)).toBeInTheDocument()

    await user.click(within(drawer).getByText(/Prep interview/))
    expect(onPrepInterview).toHaveBeenCalledWith('Backend Engineer', 'Acme Inc')

    await user.click(within(drawer).getByText(/Cover letter/))
    expect(onCoverLetter).toHaveBeenCalledWith(expect.objectContaining({ job_id: 'j1' }))

    // Esc closes it
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('tracks a job into the application tracker and disables the button', async () => {
    const user = userEvent.setup()
    render(<JobsTab />)

    await screen.findByText('Backend Engineer')
    await user.click(screen.getByText('＋ Track'))   // card-level button, no drawer open

    const tracked = JSON.parse(localStorage.getItem('ltr_tracker'))
    expect(tracked.some((t) => t.title === 'Backend Engineer')).toBe(true)

    const trackedBtn = screen.getByText('✓ Tracked')
    expect(trackedBtn).toBeDisabled()
  })

  it('shows the backup-mode banner when the primary DB is offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      status: 200,
      json: async () => String(url).includes('/jobs/stats')
        ? { total_jobs: 1 }
        : { jobs: [JOB], has_more: false, supabase_offline: true },
    })))
    render(<JobsTab />)

    expect(await screen.findByText(/backup mode/i)).toBeInTheDocument()
  })
})

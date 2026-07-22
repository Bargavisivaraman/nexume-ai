import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JobsTab from './JobsTab'

const FETCHED = { job_id: 'live1', title: 'Fetched Engineer', company: 'LiveCo' }
const SAVED = { job_id: 'sv1', title: 'Saved Analyst', company: 'KeepCo' }

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (url) => ({
    ok: true,
    status: 200,
    json: async () => String(url).includes('/jobs/stats')
      ? { total_jobs: 1 }
      : { jobs: [FETCHED], has_more: false },
  })))
})
afterEach(() => vi.unstubAllGlobals())

describe('JobsTab saved view', () => {
  it('toggles between the live feed and saved jobs', async () => {
    localStorage.setItem('nexume_saved_jobs', JSON.stringify([SAVED]))
    const user = userEvent.setup()
    render(<JobsTab />)
    await screen.findByText('Fetched Engineer')

    await user.click(screen.getAllByText(/Saved/)[0])
    expect(screen.getByText('Saved Analyst')).toBeInTheDocument()
    expect(screen.queryByText('Fetched Engineer')).not.toBeInTheDocument()

    await user.click(screen.getByText(/All jobs|All Jobs|▤/i))
    expect(await screen.findByText('Fetched Engineer')).toBeInTheDocument()
  })

  it('saving a job from a card updates localStorage and the saved count', async () => {
    const user = userEvent.setup()
    render(<JobsTab />)
    await screen.findByText('Fetched Engineer')

    await user.click(screen.getByLabelText('Save job'))

    const stored = JSON.parse(localStorage.getItem('nexume_saved_jobs'))
    expect(stored.some((j) => j.job_id === 'live1')).toBe(true)
    expect(screen.getByLabelText('Unsave job')).toBeInTheDocument()
  })
})

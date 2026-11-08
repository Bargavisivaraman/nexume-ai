import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JobsTab from './JobsTab'

const JOBS = [
  { job_id: 'a', title: 'Backend Engineer', company: 'Acme', description: 'Python and Postgres. We sponsor visas.',
    industry: 'Technology', experience_level: 'Mid Level', tech_stack: ['Python', 'Postgres'], posted_at: '2026-08-01T00:00:00Z', salary_min: 120000, salary_max: 140000, is_remote: true, url: 'https://x/a' },
  { job_id: 'b', title: 'Data Engineer', company: 'Beta', description: 'Spark pipelines. Must be authorized to work without sponsorship.',
    industry: 'Technology', experience_level: 'Mid Level', tech_stack: ['Python', 'Spark'], posted_at: '2026-08-10T00:00:00Z', salary_min: 160000, salary_max: 180000, url: 'https://x/b' },
  { job_id: 'c', title: 'Frontend Engineer', company: 'Gamma', description: 'React.',
    tech_stack: ['React'], posted_at: '2026-08-05T00:00:00Z' },
]

const stubFetch = (extra = {}) => vi.stubGlobal('fetch', vi.fn(async (url) => {
  const u = String(url)
  if (u.includes('/jobs/stats')) return { ok: true, status: 200, json: async () => ({ total_jobs: 3 }) }
  if (/\/jobs\/[^/?]+$/.test(u) && !u.includes('?')) {
    const id = u.split('/').pop()
    const job = JOBS.find(j => j.job_id === id)
    return job ? { ok: true, status: 200, json: async () => ({ job }) } : { ok: false, status: 404, json: async () => ({}) }
  }
  return { ok: true, status: 200, json: async () => ({ jobs: JOBS, has_more: false, ...extra }) }
}))

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  window.history.replaceState(null, '', '/')
  stubFetch()
})
afterEach(() => vi.unstubAllGlobals())

const titles = () => screen.getAllByText(/Engineer$/).map(el => el.textContent)

describe('Jobs tab — sorting, insights, chips', () => {
  it('defaults to newest without a resume and can sort by pay', async () => {
    const user = userEvent.setup()
    render(<JobsTab />)
    await screen.findByText('Backend Engineer')
    expect(titles()).toEqual(['Data Engineer', 'Frontend Engineer', 'Backend Engineer'])

    await user.selectOptions(screen.getByLabelText('Sort jobs'), 'salary')
    expect(titles()).toEqual(['Data Engineer', 'Backend Engineer', 'Frontend Engineer'])
  })

  it('shows a market snapshot, skill chips, and sponsorship badges', async () => {
    render(<JobsTab />)
    await screen.findByText('Backend Engineer')
    const strip = screen.getByLabelText('Market snapshot for these results')
    expect(within(strip).getByText('$150k')).toBeInTheDocument()   // median of 130k/170k
    expect(within(strip).getByText('33%')).toBeInTheDocument()     // 1 of 3 remote
    expect(screen.getAllByText('Python').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('🛂 Sponsorship')).toBeInTheDocument()
    expect(screen.getByText('🛂 No sponsorship')).toBeInTheDocument()
  })
})

describe('Jobs tab — hide, keyboard, saved searches, deep link', () => {
  it('hides a job, shows the count, and can reveal it again', async () => {
    const user = userEvent.setup()
    render(<JobsTab />)
    await screen.findByText('Frontend Engineer')

    await user.click(screen.getAllByLabelText('Hide job')[0])   // first card = Data Engineer (newest)
    expect(screen.queryByText('Data Engineer')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('nexume_hidden_jobs'))).toEqual(['b'])

    await user.click(screen.getByText(/show 1 not-interested/))
    expect(screen.getByText('Data Engineer')).toBeInTheDocument()
  })

  it('navigates with j/k and opens the drawer with Enter', async () => {
    const user = userEvent.setup()
    render(<JobsTab />)
    await screen.findByText('Backend Engineer')

    await user.keyboard('j')   // cursor → 0 (Data Engineer)
    await user.keyboard('j')   // cursor → 1 (Frontend Engineer)
    await user.keyboard('{Enter}')
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByRole('heading', { name: 'Frontend Engineer' })).toBeInTheDocument()
    expect(window.location.search).toBe('?job=c')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('saves the current search', async () => {
    const user = userEvent.setup()
    render(<JobsTab />)
    await screen.findByText('Backend Engineer')

    await user.click(screen.getByText('🔔 Save search'))
    expect(screen.getByText('🔔 Saved')).toBeInTheDocument()
    const stored = JSON.parse(localStorage.getItem('nexume_saved_searches'))
    expect(stored).toHaveLength(1)
    expect(stored[0].location).toBe('Los Angeles, CA')
    expect(screen.getByText('Los Angeles, CA', { selector: '.saved-search-main' })).toBeInTheDocument()

    // toggling again removes it
    await user.click(screen.getByText('🔔 Saved'))
    expect(JSON.parse(localStorage.getItem('nexume_saved_searches'))).toEqual([])
  })

  it('re-running a saved search reports how many jobs are new since the last visit', async () => {
    // Saved before job "b" (posted Aug 10) existed
    localStorage.setItem('nexume_saved_searches', JSON.stringify([{
      id: 'ss_1', key: 'k', query: 'engineer', location: '', filters: {},
      createdAt: 1, lastSeenAt: new Date('2026-08-07T00:00:00Z').getTime(), lastCount: 2,
    }]))
    const user = userEvent.setup()
    render(<JobsTab />)
    await screen.findByText('Backend Engineer')

    await user.click(screen.getByText('engineer', { selector: '.saved-search-main' }))
    expect(await screen.findByText(/1 new/)).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('nexume_saved_searches'))[0].lastSeenAt).toBeGreaterThan(new Date('2026-08-07T00:00:00Z').getTime())
  })

  it('opens a job from a ?job= deep link even when it is not in the list', async () => {
    window.history.replaceState(null, '', '/?job=b')
    render(<JobsTab />)
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByRole('heading', { name: 'Data Engineer' })).toBeInTheDocument()
    expect(within(drawer).getByText('🛂 No sponsorship')).toBeInTheDocument()
  })

  it('drawer lists similar jobs and hands off to Decode JD', async () => {
    const onDecodeJD = vi.fn()
    const user = userEvent.setup()
    render(<JobsTab onDecodeJD={onDecodeJD} />)
    await user.click(await screen.findByText('Backend Engineer'))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('Similar jobs')).toBeInTheDocument()
    await user.click(within(drawer).getByText(/Decode JD/))
    expect(onDecodeJD).toHaveBeenCalledWith(expect.objectContaining({ job_id: 'a' }))
  })

  it('nudges to track after clicking Apply', async () => {
    const user = userEvent.setup()
    render(<JobsTab />)
    await screen.findByText('Backend Engineer')
    const apply = screen.getAllByText('Apply Now')[0]
    apply.addEventListener('click', e => e.preventDefault())  // don't navigate in jsdom
    await user.click(apply)
    expect(await screen.findByText(/Applied to/)).toBeInTheDocument()
    await user.click(screen.getByText('＋ Track it'))
    expect(JSON.parse(localStorage.getItem('ltr_tracker')).length).toBe(1)
    expect(screen.queryByText(/Applied to/)).not.toBeInTheDocument()
  })
})

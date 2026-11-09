import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JobsTab from './JobsTab'

const JOBS = [
  { job_id: 'a', title: 'Backend Engineer', company: 'Acme', description: 'Python and Postgres.',
    industry: 'Technology', experience_level: 'Mid Level', tech_stack: ['Python', 'Postgres'], posted_at: '2026-08-01T00:00:00Z', salary_min: 120000, salary_max: 140000, is_remote: true, url: 'https://x/a' },
  { job_id: 'b', title: 'Data Engineer', company: 'Beta', description: 'Spark pipelines.',
    industry: 'Technology', experience_level: 'Mid Level', tech_stack: ['Python', 'Spark'], posted_at: '2026-08-10T00:00:00Z', salary_min: 160000, salary_max: 180000, url: 'https://x/b' },
  { job_id: 'c', title: 'Frontend Engineer', company: 'Gamma', description: 'React.',
    tech_stack: ['React'], posted_at: '2026-08-05T00:00:00Z' },
]

// Immediate stub: every list fetch resolves with `jobs`; /jobs/<id> looks up by id.
const stubResolved = (jobs = JOBS) => vi.stubGlobal('fetch', vi.fn(async (url) => {
  const u = String(url)
  if (u.includes('/jobs/stats')) return { ok: true, status: 200, json: async () => ({ total_jobs: jobs.length }) }
  if (/\/jobs\/[^/?]+$/.test(u) && !u.includes('?')) {
    const id = u.split('/').pop()
    const job = jobs.find(j => j.job_id === id)
    return job ? { ok: true, status: 200, json: async () => ({ job }) } : { ok: false, status: 404, json: async () => ({}) }
  }
  return { ok: true, status: 200, json: async () => ({ jobs, has_more: false }) }
}))

// Deferred stub: list fetches hang until the test settles them (abortable).
let pendingList
const stubDeferred = () => {
  pendingList = []
  vi.stubGlobal('fetch', vi.fn((url, opts) => {
    const u = String(url)
    if (u.includes('/jobs/?')) {
      return new Promise((resolve, reject) => {
        pendingList.push({
          url: u,
          resolve: (payload) => resolve({ ok: true, status: 200, json: async () => payload }),
          fail: (status = 400) => resolve({ ok: false, status, json: async () => ({}) }),
        })
        opts?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ total_jobs: 0 }) })
  }))
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Jobs tab — fetch lifecycle', () => {
  it('an aborted fetch does not clear the newer fetch\'s loading state', async () => {
    stubDeferred()
    const user = userEvent.setup()
    render(<JobsTab />)
    expect(pendingList).toHaveLength(1)

    // second fetch aborts the first, which is still cold-starting
    await user.click(screen.getByText('🎓 Internship'))
    expect(pendingList).toHaveLength(2)

    // the aborted fetch's finally used to flash "No jobs match" mid-load
    expect(screen.queryByText(/No jobs match/)).not.toBeInTheDocument()

    pendingList[1].resolve({ jobs: JOBS, has_more: false })
    await screen.findByText('Data Engineer')
  })

  it('a failed saved-search run does not stamp lastSeenAt or report "new" jobs', async () => {
    const seen = new Date('2026-08-07T00:00:00Z').getTime()
    localStorage.setItem('nexume_saved_searches', JSON.stringify([{
      id: 'ss_1', key: 'k', query: 'engineer', location: '', filters: {},
      createdAt: 1, lastSeenAt: seen, lastCount: 2,
    }]))
    stubDeferred()
    const user = userEvent.setup()
    render(<JobsTab />)
    pendingList[0].resolve({ jobs: JOBS, has_more: false })
    await screen.findByText('Data Engineer')

    await user.click(screen.getByText('engineer', { selector: '.saved-search-main' }))
    pendingList[1].fail(400) // backend rejects the re-run

    await screen.findByText(/Server error 400/)
    expect(JSON.parse(localStorage.getItem('nexume_saved_searches'))[0].lastSeenAt).toBe(seen)
    expect(screen.queryByText(/since your last visit/)).not.toBeInTheDocument()
  })
})

describe('Jobs tab — keyboard with the drawer open', () => {
  it('s and h act on the open job even when the cursor is elsewhere', async () => {
    window.history.replaceState(null, '', '/?job=b')
    stubResolved()
    const user = userEvent.setup()
    render(<JobsTab />)
    await screen.findByRole('dialog')
    await screen.findAllByText('Backend Engineer') // list loaded too

    await user.keyboard('s') // cursor is -1 (deep link) — must save the OPEN job
    expect(JSON.parse(localStorage.getItem('nexume_saved_jobs'))[0].job_id).toBe('b')

    await user.keyboard('h') // hide the open job → drawer closes
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('nexume_hidden_jobs'))).toEqual(['b'])
  })

  it('arrow keys step through jobs while the drawer is open', async () => {
    window.history.replaceState(null, '', '/?job=b')
    stubResolved()
    const user = userEvent.setup()
    render(<JobsTab />)
    await screen.findByRole('dialog')
    await screen.findAllByText('Backend Engineer')

    // newest-first order: Data (b), Frontend (c), Backend (a)
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Frontend Engineer' })).toBeInTheDocument()
  })
})

describe('Jobs tab — deep-link URL preservation', () => {
  it('keeps the ?job= param when the deep-link lookup 404s', async () => {
    window.history.replaceState(null, '', '/?job=gone')
    stubResolved()
    render(<JobsTab />)
    await screen.findByText('Backend Engineer')
    expect(window.location.search).toBe('?job=gone')
  })

  it('still clears the ?job= param when a deep-linked drawer is closed', async () => {
    window.history.replaceState(null, '', '/?job=b')
    stubResolved()
    const user = userEvent.setup()
    render(<JobsTab />)
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    expect(window.location.search).toBe('')
  })
})

describe('Jobs tab — off-target count', () => {
  it('counts only role-filtered jobs as off-target, not date-filtered ones', async () => {
    const de = (id, postedAt) => ({
      job_id: id, title: 'Data Engineer', company: id, description: 'ETL pipelines in Python.',
      industry: 'Technology', tech_stack: ['Python'], posted_at: postedAt, url: `https://x/${id}`,
    })
    const fresh = new Date(Date.now() - 3600_000).toISOString()
    stubResolved([de('d1', fresh), de('d2', '2026-01-05T00:00:00Z'), de('d3', '2026-02-01T00:00:00Z')])
    const user = userEvent.setup()
    render(<JobsTab />)
    await screen.findAllByText('Data Engineer')

    await user.click(screen.getByText('Pick your major'))
    await user.click(screen.getByText('Computer Science'))
    await user.click(screen.getByRole('button', { name: 'Data Engineer' }))
    await screen.findByText(/Strict role match/)

    await user.click(screen.getByText('Past week'))
    // all 3 match the role; 2 are only date-filtered → not "off-target"
    await waitFor(() => expect(screen.getAllByText('Data Engineer', { selector: '.li-job-title' })).toHaveLength(1))
    expect(screen.queryByText(/hidden as off-target/)).not.toBeInTheDocument()
  })
})

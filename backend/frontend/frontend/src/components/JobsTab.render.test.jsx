import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JobsTab from './JobsTab'

const JOB = {
  job_id: 'j1',
  title: 'Backend Engineer',
  company: 'Acme Inc',
  location: 'Austin, TX',
  source: 'Greenhouse',
}

/** Stub fetch by URL: /jobs/stats for the status bar, /jobs/ for the list. */
function stubFetch({ jobs = [JOB], status = 200 } = {}) {
  const impl = vi.fn(async (url) => {
    const u = String(url)
    if (u.includes('/jobs/stats')) {
      return { ok: true, status: 200, json: async () => ({ total_jobs: 1, last_updated: null }) }
    }
    if (status !== 200) {
      return { ok: false, status, json: async () => ({ detail: 'not found' }) }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ jobs, has_more: false, supabase_offline: false }),
    }
  })
  vi.stubGlobal('fetch', impl)
  return impl
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

describe('JobsTab orchestration', () => {
  it('renders fetched jobs into cards', async () => {
    stubFetch()
    render(<JobsTab />)

    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument()
    expect(screen.getByText('Acme Inc')).toBeInTheDocument()
  })

  it('serves the cached job list from sessionStorage while the fetch is in flight', async () => {
    sessionStorage.setItem('nexume_jobs_cache_v2', JSON.stringify({
      jobs: [{ ...JOB, job_id: 'cached', title: 'Cached Analyst' }],
      hasMore: false, page: 1, ts: Date.now(), country: 'US',
    }))
    // The list fetch never resolves — only the cache can populate the UI.
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (String(url).includes('/jobs/stats')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ total_jobs: 1 }) })
      }
      return new Promise(() => {})
    }))

    render(<JobsTab />)

    expect(await screen.findByText('Cached Analyst')).toBeInTheDocument()
  })

  it('shows an error state on a non-retryable backend failure', async () => {
    stubFetch({ status: 404 })
    render(<JobsTab />)

    expect(await screen.findByText(/not found|error|offline/i)).toBeInTheDocument()
  })

  it('sends the expanded keyword when searching', async () => {
    const impl = stubFetch()
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<JobsTab />)
    await screen.findByText('Backend Engineer')

    await user.type(screen.getByPlaceholderText(/Search jobs/), 'swe{Enter}')

    const jobCalls = impl.mock.calls.map(c => String(c[0])).filter(u => u.includes('/jobs/?'))
    expect(jobCalls.some(u => u.includes('keyword=software+engineer'))).toBe(true)
  })
})

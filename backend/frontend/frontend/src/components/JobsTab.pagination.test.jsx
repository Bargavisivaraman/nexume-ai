import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JobsTab from './JobsTab'

function jobsPage(page) {
  return {
    jobs: [{ job_id: `p${page}`, title: `Engineer Page ${page}`, company: 'Acme' }],
    has_more: true,
  }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

describe('JobsTab pagination', () => {
  it('loads and appends the next page', async () => {
    const impl = vi.fn(async (url) => {
      const u = String(url)
      if (u.includes('/jobs/stats')) {
        return { ok: true, status: 200, json: async () => ({ total_jobs: 2 }) }
      }
      const page = new URL(u).searchParams.get('page') || '1'
      return { ok: true, status: 200, json: async () => jobsPage(page) }
    })
    vi.stubGlobal('fetch', impl)

    const user = userEvent.setup()
    render(<JobsTab />)
    await screen.findByText('Engineer Page 1')

    await user.click(screen.getByText('Load more jobs'))

    // Page 2 requested and appended below page 1
    expect(await screen.findByText('Engineer Page 2')).toBeInTheDocument()
    expect(screen.getByText('Engineer Page 1')).toBeInTheDocument()
    const jobUrls = impl.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('/jobs/?'))
    expect(jobUrls.some((u) => u.includes('page=2'))).toBe(true)
  })
})

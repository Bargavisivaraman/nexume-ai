import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BulletRewriter from './BulletRewriter'

const BULLETS = [
  'responsible for maintaining the backend',
  'helped with various tasks',
]

afterEach(() => vi.unstubAllGlobals())

describe('BulletRewriter', () => {
  it('lists every weak bullet', () => {
    render(<BulletRewriter bullets={BULLETS} jobContext="" />)

    for (const b of BULLETS) {
      expect(screen.getByText(b)).toBeInTheDocument()
    }
  })

  it('rewrites a clicked bullet and shows before/after', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({
        rewritten: 'Engineered backend services cutting latency 30%.',
        explanation: 'Strong verb plus a metric.',
      }),
    })))
    const user = userEvent.setup()
    render(<BulletRewriter bullets={BULLETS} jobContext="Backend role" />)

    await user.click(screen.getByText(BULLETS[0]))

    expect(await screen.findByText(/Engineered backend services/)).toBeInTheDocument()
    expect(screen.getByText('Before')).toBeInTheDocument()
    expect(screen.getByText('Strong verb plus a metric.')).toBeInTheDocument()
  })

  it('copies the rewritten bullet to the clipboard', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({ rewritten: 'Improved X by 40%.', explanation: '' }),
    })))
    const user = userEvent.setup()
    // user-event installs its own clipboard mock on setup; spy on that one.
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    render(<BulletRewriter bullets={BULLETS} jobContext="" />)

    await user.click(screen.getByText(BULLETS[0]))
    await user.click(await screen.findByText('Copy'))

    expect(writeText).toHaveBeenCalledWith('Improved X by 40%.')
    expect(screen.getByText('✓ Copied!')).toBeInTheDocument()
  })

  it('shows a fallback message when the rewrite call fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    const user = userEvent.setup()
    render(<BulletRewriter bullets={BULLETS} jobContext="" />)

    await user.click(screen.getByText(BULLETS[0]))

    expect(await screen.findByText(/Failed to rewrite/)).toBeInTheDocument()
  })
})

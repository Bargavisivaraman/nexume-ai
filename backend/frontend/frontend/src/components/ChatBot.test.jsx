import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ChatBot from './ChatBot'

afterEach(() => vi.unstubAllGlobals())

async function openDrawer(user) {
  render(<ChatBot />)
  await user.click(screen.getByTitle('Ask Nexus'))
}

describe('ChatBot', () => {
  it('opens the drawer with the Nexus greeting', async () => {
    const user = userEvent.setup()
    await openDrawer(user)

    expect(screen.getByText('Nexus')).toBeInTheDocument()
    expect(screen.getByText(/career co-pilot\. Ask me anything/)).toBeInTheDocument()
  })

  it('sends a message and renders the reply with job cards', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        reply: 'Here are two roles worth a look.',
        jobs: [{ title: 'Backend Engineer', company: 'Acme', location: 'Austin', url: 'https://x/1' }],
      }),
    })))
    const user = userEvent.setup()
    await openDrawer(user)

    await user.type(screen.getByPlaceholderText(/Ask anything/), 'find me jobs')
    await user.click(screen.getByText('↑'))

    expect(await screen.findByText('Here are two roles worth a look.')).toBeInTheDocument()
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument()
    expect(screen.getByText(/Acme · Austin/)).toBeInTheDocument()
  })

  it('shows a friendly error when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    const user = userEvent.setup()
    await openDrawer(user)

    await user.type(screen.getByPlaceholderText(/Ask anything/), 'hello')
    await user.click(screen.getByText('↑'))

    expect(await screen.findByText(/Couldn't connect to Nexus/)).toBeInTheDocument()
  })

  it('disables send with empty input', async () => {
    const user = userEvent.setup()
    await openDrawer(user)

    expect(screen.getByText('↑').closest('button')).toBeDisabled()
  })
})

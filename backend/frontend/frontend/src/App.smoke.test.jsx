import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// App fires a module-level warmup fetch on import, so stub fetch first and
// import the component dynamically.
beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
})

async function renderApp() {
  const { default: App } = await import('./App')
  render(<App />)
}

describe('App shell', () => {
  it('boots with the nav, resume tab active, footer, and chatbot FAB', async () => {
    await renderApp()

    expect(screen.getByText('Nexume', { selector: '.nav-logo' })).toBeInTheDocument()
    expect(screen.getByText('Resume').closest('button')).toHaveClass('active')
    expect(screen.getByText(/Crafted by Bargavi Sivaraman/)).toBeInTheDocument()
    expect(screen.getByTitle('Ask Nexus')).toBeInTheDocument()
  })

  it('switches to the tracker tab from the nav', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    await renderApp()

    await user.click(screen.getByText('Tracker'))

    expect(screen.getByText('Tracker').closest('button')).toHaveClass('active')
    expect(await screen.findByText(/Application Tracker/)).toBeInTheDocument()
  })
})

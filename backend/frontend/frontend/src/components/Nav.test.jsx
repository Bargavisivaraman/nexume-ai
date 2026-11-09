import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Nav from './Nav'

beforeEach(() => localStorage.clear())

function renderNav(props = {}) {
  return render(
    <Nav tab={props.tab ?? 'resume'}
         setTab={props.setTab ?? (() => {})}
         resetApp={props.resetApp ?? (() => {})}
         theme="dark"
         setTheme={() => {}} />,
  )
}

describe('Nav', () => {
  it('renders all six tabs and marks the active one', () => {
    renderNav({ tab: 'jobs' })

    for (const label of ['Resume', 'Cover Letter', 'Jobs', 'Interview Prep', 'Tracker', 'AI Tools']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByText('Jobs').closest('button')).toHaveClass('active')
    expect(screen.getByText('Resume').closest('button')).not.toHaveClass('active')
  })

  it('switches tabs on click', async () => {
    const setTab = vi.fn()
    const user = userEvent.setup()
    renderNav({ setTab })

    await user.click(screen.getByText('Tracker'))
    expect(setTab).toHaveBeenCalledWith('tracker')
  })

  it('clicking the logo resets the app and returns to the resume tab', async () => {
    const setTab = vi.fn()
    const resetApp = vi.fn()
    const user = userEvent.setup()
    renderNav({ setTab, resetApp })

    await user.click(screen.getByText('Nexume'))
    expect(resetApp).toHaveBeenCalled()
    expect(setTab).toHaveBeenCalledWith('resume')
  })

  it('opens and closes the settings modal', async () => {
    const user = userEvent.setup()
    renderNav()

    await user.click(screen.getByTitle('Settings'))
    expect(screen.getByText('Settings')).toBeInTheDocument()

    await user.click(screen.getByText('✕'))
    expect(screen.queryByText('🎨 Appearance')).not.toBeInTheDocument()
  })
})

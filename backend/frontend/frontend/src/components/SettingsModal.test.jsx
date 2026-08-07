import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsModal from './SettingsModal'

beforeEach(() => localStorage.clear())

function renderModal(props = {}) {
  return render(
    <SettingsModal onClose={props.onClose ?? (() => {})}
                   theme={props.theme ?? 'dark'}
                   setTheme={props.setTheme ?? (() => {})} />,
  )
}

describe('SettingsModal', () => {
  it('switches the theme', async () => {
    const setTheme = vi.fn()
    const user = userEvent.setup()
    renderModal({ setTheme })

    await user.click(screen.getByText('☀ Light'))
    expect(setTheme).toHaveBeenCalledWith('light')
  })

  it('saves the profile to localStorage', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByPlaceholderText(/Bargavi/), 'Test User')
    await user.click(screen.getByText('Save Profile'))

    expect(JSON.parse(localStorage.getItem('ltr_profile')).name).toBe('Test User')
    expect(screen.getByText('✓ Saved!')).toBeInTheDocument()
  })

  it('keeps admin controls hidden until the version label is clicked five times', async () => {
    const user = userEvent.setup()
    renderModal()

    expect(screen.queryByText('🛠 Admin')).not.toBeInTheDocument()
    const unlock = screen.getByText(/Nexume · v1.0/)
    for (let i = 0; i < 5; i++) await user.click(unlock)

    expect(screen.getByText('🛠 Admin')).toBeInTheDocument()
  })

  it('toggling admin on writes the flag and fires the change event', async () => {
    const user = userEvent.setup()
    const listener = vi.fn()
    window.addEventListener('nexume_admin_change', listener)
    renderModal()

    const unlock = screen.getByText(/Nexume · v1.0/)
    for (let i = 0; i < 5; i++) await user.click(unlock)
    await user.click(screen.getByText('On'))

    expect(localStorage.getItem('nexume_admin')).toBe('1')
    expect(listener).toHaveBeenCalled()
    window.removeEventListener('nexume_admin_change', listener)
  })
})

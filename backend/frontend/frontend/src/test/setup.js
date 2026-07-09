// Vitest setup: register jest-dom matchers (toBeInTheDocument, etc.) for all tests.
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// jsdom does not implement these browser APIs that some components rely on.
// Provide minimal stubs so component tests can render.

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })
}

if (!window.IntersectionObserver) {
  class IO {
    constructor(callback) {
      this.callback = callback
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.IntersectionObserver = IO
  globalThis.IntersectionObserver = IO
}

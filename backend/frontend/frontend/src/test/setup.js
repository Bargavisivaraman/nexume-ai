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

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn()
}

// Node 22+ defines its own globalThis.localStorage/sessionStorage, whose getter
// returns undefined unless node runs with --localstorage-file. Under vitest it
// shadows jsdom's implementation (even window.localStorage comes back
// undefined), killing every storage-using test. Install a Map-backed Storage
// so tests get a deterministic, isolated store on any Node version.
class MemoryStorage {
  #map = new Map()
  get length() { return this.#map.size }
  key(i) { return [...this.#map.keys()][i] ?? null }
  getItem(k) { return this.#map.has(String(k)) ? this.#map.get(String(k)) : null }
  setItem(k, v) { this.#map.set(String(k), String(v)) }
  removeItem(k) { this.#map.delete(String(k)) }
  clear() { this.#map.clear() }
}

for (const key of ['localStorage', 'sessionStorage']) {
  if (!globalThis[key] || typeof globalThis[key].getItem !== 'function') {
    const store = new MemoryStorage()
    Object.defineProperty(globalThis, key, { value: store, configurable: true, writable: true })
    Object.defineProperty(window, key, { value: store, configurable: true, writable: true })
  }
}

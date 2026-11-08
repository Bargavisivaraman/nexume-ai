import { cleanup, render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import InterviewSimulator from './InterviewSimulator'

// ── browser API fakes ────────────────────────────────────────────────────────

class FakeSR {
  static instances = []
  constructor() { FakeSR.instances.push(this) }
  start() {}
  stop() { this.onend?.() }
  abort() {}
}

class FakeAudio {
  static instances = []
  constructor(url) { FakeAudio.instances.push(this); this.url = url }
  play() { return Promise.resolve() }
  // Mirrors the real element: pausing fires the pause event.
  pause() { this.paused = true; this.onpause?.() }
}

class FakeUtterance { constructor(text) { this.text = text } }

const srEvent = (transcript, isFinal = true) => ({
  resultIndex: 0,
  results: [{ 0: { transcript }, isFinal }],
})

const stubFetch = (message) => vi.stubGlobal('fetch', vi.fn(async (url) => {
  const u = String(url)
  if (u.includes('/interview-turn/')) return { ok: true, status: 200, json: async () => ({ message }) }
  if (u.includes('/interview-tts/'))  return { ok: true, status: 200, blob: async () => new Blob(['x']) }
  if (u.includes('/transcribe/'))     return { ok: true, status: 200, json: async () => ({ text: '' }) }
  return { ok: true, status: 200, json: async () => ({}) }
}))

beforeEach(() => {
  localStorage.clear()
  FakeSR.instances = []
  FakeAudio.instances = []
  window.SpeechRecognition = FakeSR
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  vi.stubGlobal('speechSynthesis', {
    cancel: vi.fn(),
    speak: (u) => u.onend?.(),
    getVoices: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  URL.createObjectURL = vi.fn(() => 'blob:fake')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  cleanup() // unmount BEFORE the fakes are removed — the component's teardown uses them
  delete window.SpeechRecognition
  vi.unstubAllGlobals()
})

// ── tests ────────────────────────────────────────────────────────────────────

describe('InterviewSimulator — interrupt and end mid-speech', () => {
  it('interrupting the AI unblocks speak() and starts the mic', async () => {
    stubFetch('Hello there. Tell me about yourself.')
    const user = userEvent.setup()
    render(<InterviewSimulator />)

    await user.click(screen.getByText(/Start Live Mock Interview/))
    // wait until a sentence is actually playing, then interrupt it
    await waitFor(() => expect(FakeAudio.instances.length).toBeGreaterThan(0))
    await user.click(screen.getByText('✋ Interrupt'))

    // pausing the audio must resolve the per-sentence promise → listening phase
    await screen.findByText(/done answering/)
    expect(FakeSR.instances).toHaveLength(1)
  })

  it('ending the interview mid-speech stops audio and never restarts the mic', async () => {
    stubFetch('First sentence. Second sentence.')
    const user = userEvent.setup()
    render(<InterviewSimulator />)

    await user.click(screen.getByText(/Start Live Mock Interview/))
    await waitFor(() => expect(FakeAudio.instances.length).toBeGreaterThan(0))
    await user.click(screen.getByText('⏹ End Interview'))

    // no answers yet → back to setup with an explanation, audio paused
    await screen.findByText(/No answers recorded/)
    expect(FakeAudio.instances[0].paused).toBe(true)
    await act(async () => {}) // let the unblocked speak() continuation settle
    expect(FakeSR.instances).toHaveLength(0)
  })
})

describe('InterviewSimulator — stale recognizer results', () => {
  it('ignores a flushed onresult from a recognizer that was already stopped', async () => {
    stubFetch('Welcome. Walk me through your resume.')
    const user = userEvent.setup()
    render(<InterviewSimulator />)

    await user.click(screen.getByText('Browser')) // free TTS → speaks instantly
    await user.click(screen.getByText(/Start Live Mock Interview/))
    await screen.findByText(/done answering/)
    const sr1 = FakeSR.instances[0]

    act(() => sr1.onresult(srEvent('My first answer.')))
    await user.click(screen.getByText(/done answering/))

    // second turn → a fresh recognizer is listening
    await waitFor(() => expect(FakeSR.instances).toHaveLength(2))

    // Chrome flushes a final result on the OLD recognizer after stop()
    act(() => sr1.onresult(srEvent('GHOST ANSWER')))

    expect(screen.queryByText(/GHOST ANSWER/)).not.toBeInTheDocument()
  })
})

describe('InterviewSimulator — unmount during a turn', () => {
  it('does not restart audio or the mic when the turn resolves after unmount', async () => {
    let resolveTurn
    vi.stubGlobal('fetch', vi.fn((url) => {
      const u = String(url)
      if (u.includes('/interview-turn/')) {
        return new Promise((res) => {
          resolveTurn = () => res({ ok: true, status: 200, json: async () => ({ message: 'Zombie question. Are you there?' }) })
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}), blob: async () => new Blob(['x']) })
    }))
    const user = userEvent.setup()
    const { unmount } = render(<InterviewSimulator />)

    await user.click(screen.getByText(/Start Live Mock Interview/))
    await waitFor(() => expect(resolveTurn).toBeDefined())
    unmount()

    await act(async () => { resolveTurn() })

    expect(FakeSR.instances).toHaveLength(0)
    expect(FakeAudio.instances).toHaveLength(0)
  })
})

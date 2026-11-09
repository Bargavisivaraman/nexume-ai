import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JDDecoderTool } from './ToolsV2'

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('ToolsV2 — empty result sections', () => {
  it('omits headings whose lists came back empty, keeps the populated ones', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        role_summary: 'A backend role at a fintech.',
        must_haves: ['Python'],
        nice_to_haves: [],
        hidden_expectations: [],
        green_flags: [],
        questions_to_ask: [],
      }),
    })))
    const user = userEvent.setup()
    render(<JDDecoderTool prefill={{ jd: 'x'.repeat(100) }} />)

    await user.click(screen.getByText('🧩 Decode This JD'))
    await screen.findByText('A backend role at a fintech.')

    // populated list keeps its heading…
    expect(screen.getByText(/Must-haves/)).toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
    // …empty lists must not leave orphan headings behind
    expect(screen.queryByText(/Nice-to-haves/)).not.toBeInTheDocument()
    expect(screen.queryByText('Hidden expectations')).not.toBeInTheDocument()
    expect(screen.queryByText(/Green flags/)).not.toBeInTheDocument()
    expect(screen.queryByText('Questions to ask them')).not.toBeInTheDocument()
  })
})

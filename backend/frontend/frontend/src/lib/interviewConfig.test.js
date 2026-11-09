import { describe, expect, it } from 'vitest'
import {
  MODES,
  SILENCE_BY_MODE,
  TTS_SPEED_BY_MODE,
  VOICES,
} from './interviewConfig'

describe('interview config integrity', () => {
  it('mode ids are unique', () => {
    const ids = MODES.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every mode has a silence threshold and a TTS speed', () => {
    for (const m of MODES) {
      expect(SILENCE_BY_MODE[m.id], `${m.id} missing silence`).toBeTypeOf('number')
      expect(TTS_SPEED_BY_MODE[m.id], `${m.id} missing tts speed`).toBeTypeOf('number')
    }
  })

  it('pacing tables contain no orphaned mode keys', () => {
    const ids = new Set(MODES.map((m) => m.id))
    for (const key of Object.keys(SILENCE_BY_MODE)) expect(ids.has(key)).toBe(true)
    for (const key of Object.keys(TTS_SPEED_BY_MODE)) expect(ids.has(key)).toBe(true)
  })

  it('thinking-heavy modes get longer silence windows than stress', () => {
    expect(SILENCE_BY_MODE.technical).toBeGreaterThan(SILENCE_BY_MODE.stress)
    expect(SILENCE_BY_MODE.case_study).toBeGreaterThan(SILENCE_BY_MODE.stress)
  })

  it('voice ids are unique and include the free browser voice', () => {
    const ids = VOICES.map((v) => v.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('browser')
  })
})

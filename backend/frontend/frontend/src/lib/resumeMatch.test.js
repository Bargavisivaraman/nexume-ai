import { beforeEach, describe, expect, it } from 'vitest'
import { getResumeKeywords, matchScore } from './resumeMatch'

beforeEach(() => localStorage.clear())

function seedHistory(result) {
  localStorage.setItem('ltr_history', JSON.stringify([{ result }]))
}

describe('getResumeKeywords', () => {
  it('returns null with no analysis history', () => {
    expect(getResumeKeywords()).toBeNull()
  })

  it('collects lowercase keywords from all three sources', () => {
    seedHistory({
      matched_skills: ['Python'],
      jd_match: { matched_keywords: ['AWS'] },
      skills: ['React'],
    })
    const kws = getResumeKeywords()
    expect(kws).toContain('python')
    expect(kws).toContain('aws')
    expect(kws).toContain('react')
    expect(kws.size).toBe(3)
  })

  it('returns null when the latest analysis has no keywords', () => {
    seedHistory({})
    expect(getResumeKeywords()).toBeNull()
  })

  it('survives corrupt storage', () => {
    localStorage.setItem('ltr_history', 'not json')
    expect(getResumeKeywords()).toBeNull()
  })
})

describe('matchScore', () => {
  it('returns null with no keywords', () => {
    expect(matchScore({ title: 'SWE' }, null)).toBeNull()
    expect(matchScore({ title: 'SWE' }, new Set())).toBeNull()
  })

  it('scores keyword hits against title and description', () => {
    const kws = new Set(['python', 'aws'])
    // 2 hits / max(8, 2) = 25
    expect(
      matchScore({ title: 'Python dev', description: 'AWS cloud' }, kws),
    ).toBe(25)
  })

  it('scores zero when nothing matches', () => {
    expect(matchScore({ title: 'Barista' }, new Set(['python']))).toBe(0)
  })

  it('caps the score at 100', () => {
    const kws = new Set(
      Array.from({ length: 20 }, (_, i) => `kw${i}`),
    )
    const blob = [...kws].join(' ')
    expect(matchScore({ title: blob, description: '' }, kws)).toBe(100)
  })
})

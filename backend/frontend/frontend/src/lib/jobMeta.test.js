import { describe, expect, it } from 'vitest'
import { formatEmploymentType, getSource } from './jobMeta'

describe('getSource', () => {
  it('maps known job-board hosts to friendly names', () => {
    expect(getSource('https://www.linkedin.com/jobs/view/1')).toBe('LinkedIn')
    expect(getSource('https://boards.greenhouse.io/acme/jobs/2')).toBe('boards.greenhouse.io')
    expect(getSource('https://greenhouse.io/acme')).toBe('Greenhouse')
  })

  it('returns the bare host for unknown sources', () => {
    expect(getSource('https://careers.acme.io/j/9')).toBe('careers.acme.io')
  })

  it('falls back to "Job Board" for unparseable urls', () => {
    expect(getSource('')).toBe('Job Board')
    expect(getSource('not a url')).toBe('Job Board')
  })
})

describe('formatEmploymentType', () => {
  it('prettifies the known ALL-CAPS types case-insensitively', () => {
    expect(formatEmploymentType('FULLTIME')).toBe('Full-time')
    expect(formatEmploymentType('parttime')).toBe('Part-time')
    expect(formatEmploymentType('CONTRACTOR')).toBe('Contract')
    expect(formatEmploymentType('INTERN')).toBe('Internship')
  })

  it('passes through unknown types and returns null for empty', () => {
    expect(formatEmploymentType('Seasonal')).toBe('Seasonal')
    expect(formatEmploymentType(null)).toBeNull()
    expect(formatEmploymentType('')).toBeNull()
  })
})

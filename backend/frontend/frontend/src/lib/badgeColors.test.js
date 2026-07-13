import { describe, expect, it } from 'vitest'
import { EXP_COLORS, INDUSTRY_COLORS } from './badgeColors'

// The backend's INDUSTRY_MAP buckets (jobs.py) plus its "Other" fallback.
const BACKEND_INDUSTRIES = [
  'Technology', 'Healthcare', 'Education', 'Finance', 'Legal', 'Marketing',
  'Sales', 'Design & Creative', 'Human Resources', 'Supply Chain',
  'Engineering', 'Government', 'Research & Science', 'Retail & Hospitality',
  'Business', 'Other',
]

const EXPERIENCE_LEVELS = ['Entry Level', 'Mid Level', 'Senior', 'Executive']

const HEX = /^#[0-9a-f]{6}$/

describe('INDUSTRY_COLORS', () => {
  it('covers every backend industry including the Other fallback', () => {
    for (const industry of BACKEND_INDUSTRIES) {
      expect(INDUSTRY_COLORS[industry], `missing color for ${industry}`).toBeDefined()
    }
  })

  it('contains no extra industries the backend never returns', () => {
    for (const key of Object.keys(INDUSTRY_COLORS)) {
      expect(BACKEND_INDUSTRIES, `unexpected industry ${key}`).toContain(key)
    }
  })

  it('uses valid hex colors', () => {
    for (const [key, color] of Object.entries(INDUSTRY_COLORS)) {
      expect(color, `bad color for ${key}`).toMatch(HEX)
    }
  })
})

describe('EXP_COLORS', () => {
  it('covers every experience level the backend classifies', () => {
    for (const level of EXPERIENCE_LEVELS) {
      expect(EXP_COLORS[level], `missing color for ${level}`).toMatch(HEX)
    }
  })
})

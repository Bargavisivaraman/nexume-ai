import { describe, expect, it } from 'vitest'
import { expandSearchQuery } from './search'

describe('expandSearchQuery', () => {
  it('expands whole-string abbreviations (case-insensitive)', () => {
    expect(expandSearchQuery('SWE')).toBe('software engineer')
    expect(expandSearchQuery('pm')).toBe('product manager')
    expect(expandSearchQuery('ml')).toBe('machine learning')
  })

  it('trims surrounding whitespace before matching', () => {
    expect(expandSearchQuery('  swe  ')).toBe('software engineer')
  })

  it('expands abbreviations token by token', () => {
    expect(expandSearchQuery('senior swe')).toBe('senior software engineer')
  })

  it('corrects common typos per token', () => {
    expect(expandSearchQuery('software enginner')).toBe('software engineer')
    expect(expandSearchQuery('data scientest')).toBe('data scientist')
  })

  it('normalizes hyphen and space variants', () => {
    expect(expandSearchQuery('front-end')).toBe('frontend')
    expect(expandSearchQuery('full-stack')).toBe('full stack')
  })

  it('passes through plain queries unchanged', () => {
    expect(expandSearchQuery('data scientist')).toBe('data scientist')
  })

  it('is idempotent', () => {
    const once = expandSearchQuery('swe')
    expect(expandSearchQuery(once)).toBe(once)
  })

  it('returns falsy input as-is', () => {
    expect(expandSearchQuery('')).toBe('')
    expect(expandSearchQuery(null)).toBeNull()
  })
})

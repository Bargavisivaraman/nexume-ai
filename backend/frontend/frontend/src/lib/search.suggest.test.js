import { describe, expect, it } from 'vitest'
import { suggestAlternatives } from './search'

describe('suggestAlternatives', () => {
  it('returns the raw and expanded forms for an abbreviation', () => {
    expect(suggestAlternatives('swe')).toEqual(['swe', 'software engineer'])
  })

  it('collapses to a single entry when nothing expands', () => {
    expect(suggestAlternatives('software engineer')).toEqual(['software engineer'])
  })

  it('returns an empty list for empty input', () => {
    expect(suggestAlternatives('')).toEqual([])
    expect(suggestAlternatives(null)).toEqual([])
  })
})

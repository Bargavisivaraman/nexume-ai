import { describe, expect, it } from 'vitest'
import { SECTORS, SECTOR_CATEGORIES } from './sectors'

describe('sectors data', () => {
  const categoryIds = new Set(SECTOR_CATEGORIES.map((c) => c.id))

  it('is non-empty', () => {
    expect(SECTORS.length).toBeGreaterThan(0)
  })

  it('every sector has the required fields', () => {
    for (const s of SECTORS) {
      for (const key of ['id', 'label', 'category', 'dbIndustry']) {
        expect(s[key], `${s.id} missing ${key}`).toBeTruthy()
      }
    }
  })

  it('sector ids are unique', () => {
    const ids = SECTORS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every sector references a known category', () => {
    for (const s of SECTORS) {
      expect(categoryIds.has(s.category), `${s.id} has unknown category ${s.category}`).toBe(true)
    }
  })
})

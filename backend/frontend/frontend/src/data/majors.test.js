import { describe, expect, it } from 'vitest'
import { MAJORS, MAJOR_CATEGORIES, TOTAL_ROLE_COUNT } from './majors'
import { LOCATION_BY_ID, POPULAR_LOCATIONS } from './locations'

describe('majors data', () => {
  const categoryIds = new Set(MAJOR_CATEGORIES.map((c) => c.id))

  it('every major has id/label, a known category, and non-empty roles', () => {
    for (const m of MAJORS) {
      expect(m.id).toBeTruthy()
      expect(m.label).toBeTruthy()
      expect(categoryIds.has(m.category), `${m.id} has unknown category ${m.category}`).toBe(true)
      expect(Array.isArray(m.roles) && m.roles.length > 0, `${m.id} has no roles`).toBe(true)
      for (const r of m.roles) expect(r.label).toBeTruthy()
    }
  })

  it('major ids are unique', () => {
    const ids = MAJORS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('TOTAL_ROLE_COUNT matches the sum of role lists', () => {
    expect(TOTAL_ROLE_COUNT).toBe(MAJORS.reduce((sum, m) => sum + m.roles.length, 0))
  })
})

describe('locations data', () => {
  it('LOCATION_BY_ID indexes every popular location by id', () => {
    for (const l of POPULAR_LOCATIONS) {
      expect(LOCATION_BY_ID[l.id]).toBe(l)
    }
  })
})

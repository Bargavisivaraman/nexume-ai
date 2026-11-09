import { describe, expect, it } from 'vitest'
import { roundedCount } from './format'

describe('roundedCount', () => {
  it('returns null for null/undefined/negative', () => {
    expect(roundedCount(null)).toBeNull()
    expect(roundedCount(undefined)).toBeNull()
    expect(roundedCount(-5)).toBeNull()
  })

  it('returns exact values below 10', () => {
    expect(roundedCount(0)).toBe('0')
    expect(roundedCount(9)).toBe('9')
  })

  it('floors to nearest tier with a plus for 10–999', () => {
    expect(roundedCount(23)).toBe('20+')
    expect(roundedCount(67)).toBe('60+')
    expect(roundedCount(250)).toBe('250+')
    expect(roundedCount(750)).toBe('700+')
  })

  it('formats thousands as X.YK+', () => {
    expect(roundedCount(1937)).toBe('1.9K+')
    expect(roundedCount(25400)).toBe('25K+')
    expect(roundedCount(250000)).toBe('250K+')
  })

  it('formats millions as X.YM+', () => {
    expect(roundedCount(3200000)).toBe('3.2M+')
  })
})

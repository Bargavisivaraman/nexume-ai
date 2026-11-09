import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isJobNew, timeAgo } from './format'

const NOW = new Date('2026-07-08T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('timeAgo', () => {
  it('returns an em dash for missing input', () => {
    expect(timeAgo(null)).toBe('—')
  })

  it('formats seconds, minutes, hours, and days', () => {
    expect(timeAgo('2026-07-08T11:59:30Z')).toBe('30s ago')
    expect(timeAgo('2026-07-08T11:30:00Z')).toBe('30 min ago')
    expect(timeAgo('2026-07-08T09:00:00Z')).toBe('3h ago')
    expect(timeAgo('2026-07-06T12:00:00Z')).toBe('2d ago')
  })

  it('handles future timestamps', () => {
    expect(timeAgo('2026-07-08T13:00:00Z')).toBe('in the future')
  })
})

describe('isJobNew', () => {
  it('is true when posted within the last 24 hours', () => {
    expect(isJobNew({ posted_at: '2026-07-08T02:00:00Z' })).toBe(true)
  })

  it('is false when posted more than 24 hours ago', () => {
    expect(isJobNew({ posted_at: '2026-07-06T02:00:00Z' })).toBe(false)
  })

  it('is false when posted_at is missing or invalid', () => {
    expect(isJobNew({})).toBe(false)
    expect(isJobNew({ posted_at: 'not-a-date' })).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  RELEVANCE_THRESHOLD,
  explainScore,
  filterJobsForRole,
  scoreJobForRole,
} from './roleMatcher'

const role = { label: 'Software Engineer' }

describe('scoreJobForRole', () => {
  it('returns 100 when job or role is missing', () => {
    expect(scoreJobForRole(null, role)).toBe(100)
    expect(scoreJobForRole({ title: 'x' }, null)).toBe(100)
  })

  it('returns 0 when the title is empty', () => {
    expect(scoreJobForRole({ title: '' }, role)).toBe(0)
  })

  it('scores a matching title at or above the threshold', () => {
    expect(scoreJobForRole({ title: 'Senior Software Engineer' }, role))
      .toBeGreaterThanOrEqual(RELEVANCE_THRESHOLD)
  })

  it('returns 0 for an unrelated title', () => {
    expect(scoreJobForRole({ title: 'Registered Nurse' }, role)).toBe(0)
  })
})

describe('filterJobsForRole', () => {
  it('returns the jobs unchanged when the role is null', () => {
    const jobs = [{ title: 'a' }, { title: 'b' }]
    expect(filterJobsForRole(jobs, null)).toBe(jobs)
  })

  it('filters out jobs below the threshold and attaches _relevance', () => {
    const jobs = [{ title: 'Software Engineer' }, { title: 'Registered Nurse' }]
    const out = filterJobsForRole(jobs, role)
    expect(out.every((j) => j._relevance >= RELEVANCE_THRESHOLD)).toBe(true)
    expect(out.find((j) => j.title === 'Registered Nurse')).toBeUndefined()
  })
})

describe('explainScore', () => {
  it('reports the matched includes, threshold, and show flag', () => {
    const info = explainScore({ title: 'Software Engineer' }, role)
    expect(info.threshold).toBe(RELEVANCE_THRESHOLD)
    expect(info.matched_includes).toContain('software engineer')
    expect(typeof info.show).toBe('boolean')
  })
})

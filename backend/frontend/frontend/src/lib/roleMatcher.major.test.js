import { describe, expect, it } from 'vitest'
import {
  RELEVANCE_THRESHOLD,
  filterJobsForMajor,
  scoreJobForMajor,
} from './roleMatcher'

// A major with no explicit MAJOR_RULES entry exercises the role-keyword path.
const major = { id: 'custom-major-xyz', roles: [{ label: 'Data Engineer', keywords: ['etl'] }] }

describe('scoreJobForMajor', () => {
  it('returns 100 when job or major is missing', () => {
    expect(scoreJobForMajor(null, major)).toBe(100)
    expect(scoreJobForMajor({ title: 'x' }, null)).toBe(100)
  })

  it('scores a title keyword match highest', () => {
    expect(scoreJobForMajor({ title: 'Senior Data Engineer' }, major)).toBe(80)
  })

  it('scores a description-only match lower', () => {
    expect(scoreJobForMajor({ title: 'Analyst', description: 'build etl pipelines' }, major)).toBe(62)
  })

  it('returns 0 for an unrelated job', () => {
    expect(scoreJobForMajor({ title: 'Barista' }, major)).toBe(0)
  })
})

describe('filterJobsForMajor', () => {
  it('keeps only jobs at or above the threshold and sorts by relevance', () => {
    const jobs = [
      { title: 'Barista' },
      { title: 'Data Engineer' },
      { title: 'Analyst', description: 'etl' },
    ]
    const out = filterJobsForMajor(jobs, major)

    expect(out.every((j) => j._majorRelevance >= RELEVANCE_THRESHOLD)).toBe(true)
    expect(out.find((j) => j.title === 'Barista')).toBeUndefined()
    expect(out[0]._majorRelevance).toBeGreaterThanOrEqual(out[out.length - 1]._majorRelevance)
  })
})

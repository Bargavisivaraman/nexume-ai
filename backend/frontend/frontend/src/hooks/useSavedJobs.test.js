import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import useSavedJobs from './useSavedJobs'

beforeEach(() => localStorage.clear())

describe('useSavedJobs', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useSavedJobs())
    expect(result.current.saved).toEqual([])
    expect(result.current.savedCount).toBe(0)
  })

  it('toggleSave adds then removes a job', () => {
    const { result } = renderHook(() => useSavedJobs())

    act(() => result.current.toggleSave({ job_id: 'j1', title: 'SWE' }))
    expect(result.current.isSaved('j1')).toBe(true)
    expect(result.current.savedCount).toBe(1)

    act(() => result.current.toggleSave({ job_id: 'j1' }))
    expect(result.current.isSaved('j1')).toBe(false)
    expect(result.current.savedCount).toBe(0)
  })

  it('ignores jobs without an id', () => {
    const { result } = renderHook(() => useSavedJobs())
    act(() => result.current.toggleSave({ title: 'no id' }))
    expect(result.current.savedCount).toBe(0)
  })

  it('clearAll empties the list', () => {
    const { result } = renderHook(() => useSavedJobs())
    act(() => result.current.toggleSave({ job_id: 'j1' }))
    act(() => result.current.clearAll())
    expect(result.current.saved).toEqual([])
  })

  it('persists saved jobs to localStorage', () => {
    const { result } = renderHook(() => useSavedJobs())
    act(() => result.current.toggleSave({ job_id: 'j2' }))
    const stored = JSON.parse(localStorage.getItem('nexume_saved_jobs'))
    expect(stored.some((j) => j.job_id === 'j2')).toBe(true)
  })
})

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('removes both window listeners on unmount (no leak per mount)', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useSavedJobs())
    unmount()
    for (const evt of ['storage', 'nexume_saved_jobs_change']) {
      const added = add.mock.calls.filter((c) => c[0] === evt)
      const removed = remove.mock.calls.filter((c) => c[0] === evt)
      expect(removed.length).toBe(added.length)
      // the exact handler that was added must be the one removed
      expect(removed.map((c) => c[1])).toEqual(added.map((c) => c[1]))
    }
    add.mockRestore()
    remove.mockRestore()
  })
})

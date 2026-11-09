import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFetchWithRetry } from './fetchRetry'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const ok = { ok: true, status: 200 }
const err500 = { ok: false, status: 500 }
const err404 = { ok: false, status: 404 }

describe('makeFetchWithRetry', () => {
  it('returns immediately on success without retrying', async () => {
    const fetchImpl = vi.fn(async () => ok)
    const doFetch = makeFetchWithRetry({ fetchImpl })

    await expect(doFetch('/x')).resolves.toBe(ok)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries 5xx with linear backoff and reports progress', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(err500)
      .mockResolvedValueOnce(ok)
    const onRetryMsg = vi.fn()
    const doFetch = makeFetchWithRetry({ fetchImpl, onRetryMsg, baseDelayMs: 1000 })

    const promise = doFetch('/x')
    await vi.advanceTimersByTimeAsync(1000) // first backoff: (0+1) * base
    await expect(promise).resolves.toBe(ok)

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(onRetryMsg).toHaveBeenCalledWith(expect.stringContaining('attempt 1/3'))
  })

  it('does not retry 4xx responses', async () => {
    const fetchImpl = vi.fn(async () => err404)
    const doFetch = makeFetchWithRetry({ fetchImpl })

    await expect(doFetch('/x')).resolves.toBe(err404)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('rethrows aborts immediately without retrying', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const fetchImpl = vi.fn(async () => { throw abort })
    const doFetch = makeFetchWithRetry({ fetchImpl })

    await expect(doFetch('/x')).rejects.toBe(abort)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('gives up after exhausting retries on network errors', async () => {
    const boom = new Error('network down')
    const fetchImpl = vi.fn(async () => { throw boom })
    const doFetch = makeFetchWithRetry({ fetchImpl, retries: 2, baseDelayMs: 10 })

    const promise = doFetch('/x')
    const assertion = expect(promise).rejects.toBe(boom)
    await vi.advanceTimersByTimeAsync(10) // after attempt 1
    await vi.advanceTimersByTimeAsync(20) // after attempt 2
    await assertion
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})

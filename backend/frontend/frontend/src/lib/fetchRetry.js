/**
 * Fetch with linear-backoff retries for cold-starting backends (Render free
 * tier). Retries only on 5xx responses and network failures; 4xx responses
 * return immediately and aborts are rethrown untouched.
 */
export function makeFetchWithRetry({
  onRetryMsg = () => {},
  retries = 3,
  baseDelayMs = 3000,
  fetchImpl = fetch,
} = {}) {
  return async function fetchWithRetry(url, signal) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetchImpl(url, { signal });
        if (res.ok) return res;
        if (res.status < 500 || attempt === retries) return res;
        onRetryMsg(`Server warming up… (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, (attempt + 1) * baseDelayMs));
      } catch (e) {
        if (e.name === "AbortError") throw e;
        if (attempt === retries) throw e;
        onRetryMsg(`Retrying… (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, (attempt + 1) * baseDelayMs));
      }
    }
  };
}

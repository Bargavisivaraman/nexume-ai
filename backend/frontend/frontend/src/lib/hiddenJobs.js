/**
 * "Not interested" — jobs the user hid. Stored as a capped id list in
 * localStorage so the feed stays clean across visits.
 */

const KEY = "nexume_hidden_jobs";
const MAX = 500;

export function loadHidden() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY)) || [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

function persist(set) {
  try { localStorage.setItem(KEY, JSON.stringify([...set].slice(-MAX))); }
  catch { /* storage unavailable */ }
  return set;
}

/** Returns a NEW Set with the id added (immutable for React state). */
export function hideJob(set, jobId) {
  if (!jobId) return set;
  const next = new Set(set); next.add(jobId);
  return persist(next);
}

/** Returns a NEW Set with the id removed. */
export function unhideJob(set, jobId) {
  const next = new Set(set); next.delete(jobId);
  return persist(next);
}

export function clearHidden() {
  return persist(new Set());
}

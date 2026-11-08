/**
 * Saved searches ("alerts" without email): a named snapshot of query +
 * location + filters + major/role, plus when the user last looked at it so
 * we can say "12 new since your last visit".
 */

const KEY = "nexume_saved_searches";
const MAX = 12;

export function loadSavedSearches() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY)) || [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function persist(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); }
  catch { /* storage unavailable */ }
  return list.slice(0, MAX);
}

const clean = (v) => (typeof v === "string" ? v.trim() : v);

/** Human label for a search snapshot, e.g. "frontend · Austin, TX · Remote". */
export function describeSearch(s, { majorLabel, roleLabel } = {}) {
  const parts = [];
  if (clean(s.query)) parts.push(s.query.trim());
  else if (roleLabel) parts.push(roleLabel);
  else if (majorLabel) parts.push(majorLabel);
  if (clean(s.location)) parts.push(s.location.trim());
  const f = s.filters || {};
  if (f.remote) parts.push("Remote");
  if (f.internship) parts.push("Internship");
  if (f.newGrad) parts.push("New grad");
  if (f.expLevel) parts.push(f.expLevel);
  if (f.jobType && !f.internship) parts.push(f.jobType);
  if (f.dateRange && f.dateRange !== "all") parts.push({ "24h": "Past 24h", "7d": "Past week", "30d": "Past month" }[f.dateRange] || f.dateRange);
  return parts.join(" · ") || "All jobs";
}

/** Stable key so the same search isn't saved twice. */
export function searchKey(s) {
  const f = s.filters || {};
  return JSON.stringify([
    clean(s.query) || "", clean(s.location) || "", s.majorId || null, s.roleId || null, s.sectorId || null,
    !!f.remote, !!f.internship, !!f.newGrad, f.expLevel || "", f.jobType || "", f.dateRange || "all",
  ]);
}

/**
 * Add (or refresh) a search. Returns the new list; the saved entry is first.
 * `resultCount` seeds what the user has "seen" so the first re-run is honest.
 */
export function saveSearch(list, snapshot, { resultCount = 0, now = Date.now() } = {}) {
  const key = searchKey(snapshot);
  const existing = list.find(s => s.key === key);
  const entry = {
    id: existing?.id || `ss_${now.toString(36)}`,
    key,
    query: clean(snapshot.query) || "",
    location: clean(snapshot.location) || "",
    majorId: snapshot.majorId || null,
    roleId: snapshot.roleId || null,
    sectorId: snapshot.sectorId || null,
    filters: { ...(snapshot.filters || {}) },
    createdAt: existing?.createdAt || now,
    lastSeenAt: now,
    lastCount: resultCount,
  };
  return persist([entry, ...list.filter(s => s.key !== key)]);
}

export function removeSearch(list, id) {
  return persist(list.filter(s => s.id !== id));
}

/** Mark a search as viewed now. */
export function touchSearch(list, id, { resultCount, now = Date.now() } = {}) {
  return persist(list.map(s => s.id === id ? { ...s, lastSeenAt: now, lastCount: resultCount ?? s.lastCount } : s));
}

/** Jobs posted after `sinceMs` (uses posted_at; unknown dates don't count). */
export function countNewSince(jobs, sinceMs) {
  if (!sinceMs) return 0;
  let n = 0;
  for (const j of jobs || []) {
    const t = j?.posted_at ? new Date(j.posted_at).getTime() : NaN;
    if (!Number.isNaN(t) && t > sinceMs) n++;
  }
  return n;
}

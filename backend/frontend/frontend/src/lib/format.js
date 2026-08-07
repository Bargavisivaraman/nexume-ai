/**
 * Display formatters — always round counts down to a clean tier so the UI
 * never shows awkward specific numbers like "1937" or "55".
 */

/**
 * roundedCount(n) → polished label like "50+", "1.9K+", "10K+".
 * Returns null if n is null/undefined/negative (caller should hide the label).
 *
 * Tiering:
 *   < 10        → exact ("0", "5", "9")
 *   10–999      → floor to nearest 10/50/100 + "+"
 *   1K–10K      → "X.YK+" floored to nearest 100 (1937 → 1.9K+)
 *   10K–100K    → "XXK+" floored to nearest 1000 (25,400 → 25K+)
 *   100K–1M     → "XXXK+" floored to nearest 10000 (250,000 → 250K+)
 *   ≥ 1M        → "X.YM+"
 */
export function roundedCount(n) {
  if (n == null || n < 0) return null;
  const x = Math.floor(n);
  if (x < 10)    return String(x);
  if (x < 50)    return `${Math.floor(x / 10) * 10}+`;       // 23 → 20+
  if (x < 100)   return `${Math.floor(x / 10) * 10}+`;       // 67 → 60+
  if (x < 500)   return `${Math.floor(x / 50) * 50}+`;       // 250 → 250+
  if (x < 1000)  return `${Math.floor(x / 100) * 100}+`;     // 750 → 700+
  if (x < 10000) {
    const k = Math.floor(x / 100) / 10;                       // 1937 → 1.9
    return `${k.toFixed(1)}K+`;
  }
  if (x < 100000) return `${Math.floor(x / 1000)}K+`;        // 25,400 → 25K+
  if (x < 1000000) return `${Math.floor(x / 10000) * 10}K+`; // 250,000 → 250K+
  return `${(Math.floor(x / 100000) / 10).toFixed(1)}M+`;
}

/**
 * timeAgo(iso) → "3 min ago" / "2h ago" / "5d ago". Returns "—" when null.
 */
export function timeAgo(iso) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "in the future";
  const s = Math.floor(ms / 1000);
  if (s < 60)   return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/**
 * isJobNew(job) → true only if the job was POSTED within the last 24 hours.
 * Uses posted_at, never fetched_at. Hides NEW when posted_at is missing.
 */
export function isJobNew(job) {
  if (!job?.posted_at) return false;
  const posted = new Date(job.posted_at).getTime();
  if (isNaN(posted)) return false;
  const ageMs = Date.now() - posted;
  return ageMs >= 0 && ageMs < 24 * 60 * 60 * 1000;
}

/**
 * Application-tracker store — shared access to the tracker's localStorage
 * list so other tabs (Jobs marketplace) can add applications directly.
 *
 * Entry shape (matches TrackerPage's existing format):
 *   { id, title, company, url, notes, status, date }
 */

export const TRACKER_KEY = "ltr_tracker";

export function loadTracker() {
  try {
    const list = JSON.parse(localStorage.getItem(TRACKER_KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function normalize(s) {
  return (s || "").trim().toLowerCase();
}

/** A job matches a tracker entry when the apply URL matches, or title+company do. */
export function isJobTracked(job, list = loadTracker()) {
  const url = normalize(job.url || job.job_url);
  const key = `${normalize(job.title)}|${normalize(job.company)}`;
  return list.some(e =>
    (url && normalize(e.url) === url) ||
    `${normalize(e.title)}|${normalize(e.company)}` === key
  );
}

/**
 * Add a marketplace job to the tracker (status "applied" by default —
 * clicking Track usually means "I'm applying to this").
 * Idempotent: returns the unchanged list if the job is already tracked.
 */
export function addJobToTracker(job, list = loadTracker()) {
  if (isJobTracked(job, list)) return list;
  const entry = {
    id:      Date.now(),
    title:   job.title || "",
    company: job.company || "",
    url:     job.url || job.job_url || "",
    notes:   job.location ? `Location: ${job.location}` : "",
    status:  "applied",
    date:    new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  };
  const updated = [entry, ...list];
  try { localStorage.setItem(TRACKER_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

/** CSV export of tracker entries. Fields quoted; embedded quotes doubled. */
export function trackerToCsv(list = loadTracker()) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Company", "Position", "Status", "Date Applied", "Notes", "Link"];
  const rows = list.map(e => [e.company, e.title, e.status, e.date, e.notes, e.url].map(esc).join(","));
  return [header.map(esc).join(","), ...rows].join("\n");
}

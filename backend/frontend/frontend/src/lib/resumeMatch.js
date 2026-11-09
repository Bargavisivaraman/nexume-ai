/**
 * Resume-to-job keyword matching. Reads the latest analyzed resume from
 * localStorage and scores jobs against its extracted skills/keywords.
 */

const HISTORY_KEY = "ltr_history";

/**
 * Collect lowercase keywords from the most recent resume analysis.
 * Returns a Set, or null when no analysis (or no keywords) is available.
 */
export function getResumeKeywords() {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    if (!history.length) return null;
    const latest = history[0].result;
    const kws = new Set();
    if (Array.isArray(latest?.matched_skills))
      latest.matched_skills.forEach((k) => kws.add(k.toLowerCase()));
    if (Array.isArray(latest?.jd_match?.matched_keywords))
      latest.jd_match.matched_keywords.forEach((k) => kws.add(k.toLowerCase()));
    if (Array.isArray(latest?.skills))
      latest.skills.forEach((k) => kws.add(k.toLowerCase()));
    return kws.size > 0 ? kws : null;
  } catch {
    return null;
  }
}

/**
 * Crude 0–100 match score between a job and the resume keywords.
 * Returns null when there is nothing to score against.
 */
export function matchScore(job, resumeKeywords) {
  if (!resumeKeywords) return null;
  const blob = `${job.title || ""} ${job.description || ""}`.toLowerCase();
  let hits = 0;
  let total = 0;
  for (const kw of resumeKeywords) {
    total += 1;
    if (blob.includes(kw)) hits += 1;
  }
  if (total === 0) return null;
  return Math.min(100, Math.round((hits / Math.max(8, total)) * 100));
}

/**
 * Pure helpers that turn a list of job rows into product features:
 * sorting, market insights, similar-job lookup, skill chips, sponsorship flag.
 * No React, no storage — everything here is unit-testable.
 */

export const SORT_MODES = [
  { id: "match",  label: "Best match" },
  { id: "newest", label: "Newest" },
  { id: "salary", label: "Highest pay" },
];

const postedMs = (j) => {
  const t = j?.posted_at ? new Date(j.posted_at).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/** Midpoint of a job's salary range, or null when it lists none. */
export function salaryMid(j) {
  const lo = j?.salary_min, hi = j?.salary_max;
  if (lo == null && hi == null) return null;
  const a = lo ?? hi, b = hi ?? lo;
  if (!(a > 0) && !(b > 0)) return null;
  return (a + b) / 2;
}

/**
 * Stable sort of jobs. `scoreOf(job)` supplies the match score (may return
 * null → treated as -1 so unscored jobs sink but keep their relative order).
 */
export function sortJobs(jobs, mode, scoreOf = () => null) {
  const list = jobs.map((j, i) => ({ j, i }));
  const cmp = {
    match:  (a, b) => ((scoreOf(b.j) ?? -1) - (scoreOf(a.j) ?? -1)) || (postedMs(b.j) - postedMs(a.j)),
    newest: (a, b) => postedMs(b.j) - postedMs(a.j),
    salary: (a, b) => ((salaryMid(b.j) ?? -1) - (salaryMid(a.j) ?? -1)) || (postedMs(b.j) - postedMs(a.j)),
  }[mode];
  if (!cmp) return jobs.slice();
  return list.sort((a, b) => cmp(a, b) || (a.i - b.i)).map(x => x.j);
}

const median = (nums) => {
  if (!nums.length) return null;
  const s = nums.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Market snapshot for the visible result set.
 * Returns null for an empty list.
 */
export function salaryInsights(jobs) {
  if (!jobs?.length) return null;
  const mids = jobs.map(salaryMid).filter(v => v != null);
  const remote = jobs.filter(j => j.is_remote).length;
  const skills = new Map();
  for (const j of jobs) {
    for (const s of (Array.isArray(j.tech_stack) ? j.tech_stack : [])) {
      skills.set(s, (skills.get(s) || 0) + 1);
    }
  }
  const topSkills = [...skills.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count }));
  const companies = new Set(jobs.map(j => j.company).filter(Boolean)).size;
  return {
    total: jobs.length,
    medianSalary: median(mids),
    pctWithSalary: Math.round((mids.length / jobs.length) * 100),
    remotePct: Math.round((remote / jobs.length) * 100),
    companies,
    topSkills,
  };
}

const SPONSOR_RE = /\b(visa sponsorship|sponsor(?:ship)?\b|h-?1b|opt\b|cpt\b|work authorization|authorized to work)/i;
const NO_SPONSOR_RE = /\b(no|not|unable to|cannot|can't|won't|will not|does not|do not)\b[^.]{0,40}\bsponsor/i
;
const MUST_AUTH_RE = /\b(must be|are required to be|required to be|currently)\b[^.]{0,30}\b(authori[sz]ed|eligible) to work\b[^.]{0,60}\b(without|no)\b[^.]{0,20}\bsponsor/i;

/**
 * Sponsorship signal from the job text.
 *   "none"     → no mention at all
 *   "no"       → explicitly says it won't sponsor / needs pre-existing authorization
 *   "mentions" → talks about sponsorship/visas without a clear negative
 */
export function sponsorshipSignal(job) {
  const text = `${job?.title || ""} ${job?.description || ""}`;
  if (!SPONSOR_RE.test(text)) return "none";
  if (NO_SPONSOR_RE.test(text) || MUST_AUTH_RE.test(text)) return "no";
  return "mentions";
}

const STOP = new Set(["the", "and", "for", "with", "of", "in", "to", "a", "an", "at", "on", "or", "senior", "junior", "lead", "staff", "ii", "iii", "iv", "sr", "jr", "engineer", "manager", "specialist", "associate", "remote", "hybrid"]);
const tokens = (s) => new Set((s || "").toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").split(/\s+/).filter(w => w.length > 1 && !STOP.has(w)));

/**
 * Rank other jobs by similarity to `job`: title-token overlap (Jaccard),
 * shared tech stack, same industry, same company. Excludes the job itself.
 */
export function similarJobs(job, pool, n = 4) {
  if (!job) return [];
  const t = tokens(job.title);
  const stack = new Set(Array.isArray(job.tech_stack) ? job.tech_stack.map(s => s.toLowerCase()) : []);
  const scored = [];
  for (const other of pool || []) {
    if (!other || other.job_id === job.job_id) continue;
    const ot = tokens(other.title);
    let inter = 0; for (const w of t) if (ot.has(w)) inter++;
    const union = t.size + ot.size - inter;
    let score = union ? (inter / union) * 60 : 0;
    const os = Array.isArray(other.tech_stack) ? other.tech_stack : [];
    const sharedStack = os.filter(s => stack.has(String(s).toLowerCase())).length;
    score += Math.min(sharedStack, 4) * 5;
    if (job.industry && other.industry === job.industry && other.industry !== "Other") score += 8;
    if (job.company && other.company === job.company) score += 6;
    if (job.experience_level && other.experience_level === job.experience_level) score += 4;
    if (score > 8) scored.push({ job: other, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, n).map(x => x.job);
}

/**
 * Skill chips for a card: up to `max` items from tech_stack, resume-matched
 * ones first. `resumeKeywords` is a Set of lowercase keywords or null.
 */
export function skillChips(job, resumeKeywords, max = 5) {
  const stack = Array.isArray(job?.tech_stack) ? job.tech_stack.filter(Boolean) : [];
  if (!stack.length) return { chips: [], extra: 0 };
  const chips = stack.map(name => ({ name, matched: !!resumeKeywords && resumeKeywords.has(String(name).toLowerCase()) }));
  chips.sort((a, b) => (b.matched ? 1 : 0) - (a.matched ? 1 : 0));
  return { chips: chips.slice(0, max), extra: Math.max(0, chips.length - max) };
}

export const formatK = (n) => (n == null ? "—" : `$${Math.round(n / 1000)}k`);

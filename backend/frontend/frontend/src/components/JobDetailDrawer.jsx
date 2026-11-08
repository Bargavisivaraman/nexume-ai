import { useEffect, useMemo, useState } from "react";
import CompanyAvatar from "./CompanyAvatar";
import { similarJobs, sponsorshipSignal, formatK, salaryMid } from "../lib/jobInsights";
import { INDUSTRY_COLORS, EXP_COLORS } from "../lib/badgeColors";
import { formatEmploymentType } from "../lib/jobMeta";

/** Shareable URL for a job: current origin + ?job=<id>. */
function jobShareUrl(jobId) {
  const u = new URL(window.location.href);
  u.search = "";
  u.hash = "";
  u.searchParams.set("job", jobId);
  return u.toString();
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const h = Math.floor((Date.now() - new Date(dateStr)) / 3600000);
  if (Number.isNaN(h)) return null;
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : `${Math.floor(d / 7)}w ago`;
}

/**
 * Slide-over with everything about one job: full description, stack, pay,
 * sponsorship signal, similar jobs, and every action (apply / save / track /
 * interview prep / cover letter / decode JD / hide / share).
 */
export default function JobDetailDrawer({
  job, pool = [], onClose, onSelect,
  saved, onToggleSave, tracked, onTrack, onHide,
  onPrepInterview, onCoverLetter, onDecodeJD, onApplied,
  resumeKeywords, matchScore,
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!job) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("drawer-open");
    return () => { window.removeEventListener("keydown", onKey); document.body.classList.remove("drawer-open"); };
  }, [job, onClose]);

  const similar = useMemo(() => similarJobs(job, pool, 4), [job, pool]);
  if (!job) return null;

  const url = job.url || job.job_url;
  const indColor = INDUSTRY_COLORS[job.industry] || "#94a3b8";
  const expColor = EXP_COLORS[job.experience_level] || "#94a3b8";
  const empType = formatEmploymentType(job.employment_type || job.job_type);
  const sponsor = sponsorshipSignal(job);
  const mid = salaryMid(job);
  const salaryText = job.salary_min && job.salary_max
    ? `${formatK(job.salary_min)} – ${formatK(job.salary_max)}`
    : mid ? `~${formatK(mid)}` : null;
  const stack = Array.isArray(job.tech_stack) ? job.tech_stack : [];
  const posted = timeAgo(job.posted_at);

  const share = () => {
    const link = jobShareUrl(job.job_id);
    navigator.clipboard?.writeText(link);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="jd-overlay" onClick={onClose} role="presentation">
      <aside className="jd-drawer" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${job.title} at ${job.company}`}>
        <div className="jd-head">
          <CompanyAvatar name={job.company} size={52} />
          <div className="jd-head-info">
            <h2 className="jd-title">{job.title || "Untitled"}</h2>
            <div className="jd-company">{job.company || "Company not listed"}{job.location ? ` · ${job.location}` : ""}</div>
            <div className="jd-sub">
              {posted && <span>Posted {posted}</span>}
              {(job.source || job.source_name) && <span>via {job.source || job.source_name}</span>}
              {matchScore != null && <span className="jd-match" style={{ color: matchScore >= 70 ? "#22e597" : matchScore >= 40 ? "#ffce47" : "#94a3b8" }}>{matchScore}% match</span>}
            </div>
          </div>
          <button className="jd-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="jd-badges">
          {job.industry && job.industry !== "Other" && <span className="li-badge" style={{ color: indColor, background: `${indColor}1f`, borderColor: `${indColor}55` }}>{job.industry}</span>}
          {job.experience_level && <span className="li-badge" style={{ color: expColor, background: `${expColor}1f`, borderColor: `${expColor}55` }}>{job.experience_level}</span>}
          {empType && <span className="li-badge" style={{ color: "var(--text-muted)", background: "var(--surface-2)", borderColor: "var(--border)" }}>{empType}</span>}
          {job.work_mode && <span className="li-badge" style={{ color: job.is_remote ? "#22e597" : "var(--text-muted)", background: job.is_remote ? "rgba(34,229,151,0.12)" : "var(--surface-2)", borderColor: job.is_remote ? "rgba(34,229,151,0.32)" : "var(--border)" }}>{job.work_mode}</span>}
          {salaryText && <span className="li-badge li-badge-salary">{salaryText}{job.salary_period === "hour" ? "/hr" : ""}</span>}
          {sponsor === "mentions" && <span className="li-badge jd-sponsor ok" title="The posting talks about visa sponsorship or work authorization. Read the wording carefully.">🛂 Mentions sponsorship</span>}
          {sponsor === "no" && <span className="li-badge jd-sponsor no" title="The posting says it will not sponsor, or requires existing work authorization.">🛂 No sponsorship</span>}
        </div>

        <div className="jd-actions">
          {url ? (
            <a className="li-apply-btn" href={url} target="_blank" rel="noopener noreferrer" onClick={() => onApplied?.(job)}>Apply Now ↗</a>
          ) : <span className="li-apply-btn apply-na">No link</span>}
          <button className={`li-prep-btn ${saved ? "is-on" : ""}`} onClick={() => onToggleSave?.(job)}>{saved ? "♥ Saved" : "♡ Save"}</button>
          <button className={`li-track-btn ${tracked ? "tracked" : ""}`} disabled={tracked} onClick={() => onTrack?.(job)}>{tracked ? "✓ Tracked" : "＋ Track"}</button>
          <button className="li-prep-btn" onClick={() => onPrepInterview?.(job.title, job.company)}>🎙 Prep interview</button>
          {onCoverLetter && <button className="li-prep-btn" onClick={() => onCoverLetter(job)}>✉ Cover letter</button>}
          {onDecodeJD && job.description && <button className="li-prep-btn" onClick={() => onDecodeJD(job)}>🧩 Decode JD</button>}
          <button className="li-prep-btn" onClick={share}>{copied ? "✓ Link copied" : "🔗 Share"}</button>
          <button className="li-prep-btn jd-hide" onClick={() => { onHide?.(job); onClose?.(); }} title="Hide this job from your feed">Not interested</button>
        </div>

        {stack.length > 0 && (
          <section className="jd-section">
            <h3>Skills mentioned</h3>
            <div className="jd-stack">
              {stack.map(s => {
                const hit = !!resumeKeywords && resumeKeywords.has(String(s).toLowerCase());
                return <span key={s} className={`skill-chip ${hit ? "hit" : ""}`} title={hit ? "On your resume" : undefined}>{hit ? "✓ " : ""}{s}</span>;
              })}
            </div>
          </section>
        )}

        <section className="jd-section">
          <h3>About the role</h3>
          <div className="jd-description">{job.description || "No description was provided by the source. Open the posting for details."}</div>
        </section>

        {similar.length > 0 && (
          <section className="jd-section">
            <h3>Similar jobs</h3>
            <div className="jd-similar">
              {similar.map(s => (
                <button key={s.job_id} className="jd-similar-card" onClick={() => onSelect?.(s)}>
                  <CompanyAvatar name={s.company} size={30} />
                  <div className="jd-similar-info">
                    <div className="jd-similar-title">{s.title}</div>
                    <div className="jd-similar-meta">{s.company}{s.location ? ` · ${s.location}` : ""}{salaryMid(s) ? ` · ~${formatK(salaryMid(s))}` : ""}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="jd-foot">Esc to close · j / k to move between jobs · s to save · h to hide</div>
      </aside>
    </div>
  );
}

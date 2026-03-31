import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

// ── ATS BREAKDOWN ─────────────────────────────────────────────────────────────
function ATSBreakdown({ breakdown }) {
  if (!breakdown) return null;
  const categories = [
    { label: "Resume Sections",   pts: breakdown.sections?.normalised_points ?? 0,  max: 30 },
    { label: "Quantified Impact", pts: breakdown.quantification?.points ?? 0,        max: 30 },
    { label: "Action Verbs",      pts: breakdown.action_verbs?.points ?? 0,          max: 20 },
    { label: "Keyword Relevance", pts: breakdown.keywords?.points ?? 0,              max: 30 },
    { label: "Length & Format",   pts: breakdown.length_format?.points ?? 0,         max: 15 },
    { label: "Contact Info",      pts: breakdown.contact_info?.points ?? 0,          max: 10 },
  ];
  return (
    <div className="ats-breakdown reveal">
      <div className="breakdown-header">Score Breakdown</div>
      {categories.map(({ label, pts, max }) => {
        const pct = Math.round((pts / max) * 100);
        const color = pct >= 70 ? "#30d158" : pct >= 40 ? "#ffd60a" : "#ff453a";
        return (
          <div key={label} className="breakdown-row">
            <div className="breakdown-label">{label}</div>
            <div className="breakdown-bar-wrap">
              <div className="breakdown-bar" style={{ width: `${pct}%`, background: color }} />
            </div>
            <div className="breakdown-pts" style={{ color }}>{pts}/{max}</div>
          </div>
        );
      })}
    </div>
  );
}

const API = "https://landtherole-ai.onrender.com";

// Fire-and-forget warm-up ping so Render server is hot before first user action
fetch(`${API}/jobs/?country=US&per_page=1`).catch(() => {});

// ── FOOTER ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="footer">
      <p><span>Lumira.ai</span> · Built by Bargavi Sivaraman · © 2026</p>
    </footer>
  );
}

// ── FLOATING ORBS ─────────────────────────────────────────────────────────────
function FloatingOrbs() {
  return (
    <div className="orbs-wrap" aria-hidden="true">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
    </div>
  );
}

// ── NAV ───────────────────────────────────────────────────────────────────────
const NAV_ICONS = {
  resume:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  cover:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  jobs:        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  interview:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  tracker:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>,
  tools:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
};

const PROFILE_KEY = "ltr_profile";
function loadProfile() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch { return {}; } }
function saveProfile(p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }

function SettingsModal({ onClose, theme, setTheme }) {
  const [profile, setProfile] = useState(loadProfile);
  const [saved, setSaved]     = useState(false);
  const history = (() => { try { return JSON.parse(localStorage.getItem("ltr_history")) || []; } catch { return []; } })();

  const saveBtn = () => {
    saveProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const clearHistory = () => {
    localStorage.removeItem("ltr_history");
    window.dispatchEvent(new Event("ltr_history_change"));
  };

  return (
    <div className="settings-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal">
        <div className="settings-modal-head">
          <div className="settings-modal-title">Settings</div>
          <button className="settings-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="settings-modal-body">

          {/* ── Appearance ── */}
          <div className="sm-group">
            <div className="sm-group-label">🎨 Appearance</div>
            <div className="sm-row">
              <span className="sm-row-text">Theme</span>
              <div className="theme-toggle">
                <button className={`theme-option ${theme==="dark"?"active":""}`} onClick={() => setTheme("dark")}>🌙 Dark</button>
                <button className={`theme-option ${theme==="light"?"active":""}`} onClick={() => setTheme("light")}>☀ Light</button>
              </div>
            </div>
          </div>

          {/* ── Profile ── */}
          <div className="sm-group">
            <div className="sm-group-label">👤 Profile</div>
            <div className="sm-field">
              <label className="sm-field-label">Name</label>
              <input className="sm-input" placeholder="e.g. Bargavi Sivaraman" value={profile.name||""} onChange={e => setProfile(p=>({...p,name:e.target.value}))} />
            </div>
            <div className="sm-field">
              <label className="sm-field-label">Email</label>
              <input className="sm-input" placeholder="you@email.com" value={profile.email||""} onChange={e => setProfile(p=>({...p,email:e.target.value}))} />
            </div>
            <div className="sm-field">
              <label className="sm-field-label">Target Role</label>
              <input className="sm-input" placeholder="e.g. Software Engineer" value={profile.role||""} onChange={e => setProfile(p=>({...p,role:e.target.value}))} />
            </div>
            <div className="sm-field">
              <label className="sm-field-label">Location</label>
              <input className="sm-input" placeholder="e.g. San Francisco, CA" value={profile.location||""} onChange={e => setProfile(p=>({...p,location:e.target.value}))} />
            </div>
            <button className="sm-save-btn" onClick={saveBtn}>{saved ? "✓ Saved!" : "Save Profile"}</button>
          </div>

          {/* ── Resume History ── */}
          <div className="sm-group">
            <div className="sm-group-label">📂 Resume History</div>
            {history.length === 0 ? (
              <div className="sm-empty">No resumes analyzed yet.<br/>Upload your first resume to get started.</div>
            ) : (
              <>
                <div className="sm-history-list">
                  {history.map(h => {
                    const c = h.score >= 75 ? "#30d158" : h.score >= 50 ? "#ffd60a" : "#ff453a";
                    return (
                      <div key={h.id} className="sm-history-item">
                        <div className="sm-history-info">
                          <div className="sm-history-name">{h.name}</div>
                          <div className="sm-history-meta">{h.date}</div>
                        </div>
                        <div className="sm-history-score" style={{color:c}}>{h.score}</div>
                      </div>
                    );
                  })}
                </div>
                <button className="sm-clear-btn" onClick={clearHistory}>🗑 Clear All History</button>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── CHATBOT ────────────────────────────────────────────────────────────────────
function ChatBot() {
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState([{ role:"assistant", content:"Hey, I'm Nexus ✨ Your AI career co-pilot. Ask me anything. Resume tips, interview prep, salary negotiation, job search strategy." }]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);
  const inputRef              = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 120); }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMsgs = [...msgs, { role:"user", content:text }];
    setMsgs(newMsgs);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/chat/`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ messages: newMsgs.filter(m=>m.role!=="system") }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      setMsgs(prev => [...prev, { role:"assistant", content: data.reply || "No response received.", jobs: data.jobs || [] }]);
    } catch (e) {
      setMsgs(prev => [...prev, { role:"assistant", content:`Couldn't connect to Nexus. ${e.message || "Please try again."}` }]);
    } finally { setLoading(false); }
  };

  const onKey = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <>
      <button className={`chat-fab ${open?"open":""}`} onClick={() => setOpen(v=>!v)} title="Ask Nexus">
        {open ? "✕" : <><span className="chat-fab-icon">✨</span><span className="chat-fab-label">Ask Nexus</span></>}
      </button>
      {open && (
        <div className="chat-drawer">
          <div className="chat-drawer-head">
            <div className="chat-head-info">
              <div className="chat-head-avatar">🤖</div>
              <div>
                <div className="chat-head-name">Nexus</div>
                <div className="chat-head-sub">Your career co-pilot</div>
              </div>
            </div>
            <button className="chat-close-btn" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="chat-messages">
            {msgs.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.role === "assistant" && <div className="chat-msg-avatar">🤖</div>}
                <div>
                  <div className="chat-bubble">{m.content}</div>
                  {m.jobs && m.jobs.length > 0 && (
                    <div className="chat-job-cards">
                      {m.jobs.map((j, ji) => (
                        <a key={ji} className="chat-job-card" href={j.url || j.job_url || "#"} target="_blank" rel="noopener noreferrer">
                          <div className="chat-job-title">{j.title}</div>
                          <div className="chat-job-company">{j.company} · {j.location || j.state || "Remote"}</div>
                          {(j.employment_type || j.experience_level) && (
                            <div className="chat-job-meta">{j.employment_type || ""}{j.employment_type && j.experience_level ? " · " : ""}{j.experience_level || ""}</div>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-msg assistant">
                <div className="chat-msg-avatar">🤖</div>
                <div className="chat-bubble chat-typing"><span/><span/><span/></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="chat-input-row">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Ask anything about your job search…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
            />
            <button className="chat-send-btn" onClick={send} disabled={!input.trim()||loading}>
              {loading ? <span className="spinner"/> : "↑"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Nav({ tab, setTab, resetApp, theme, setTheme }) {
  const [showSettings, setShowSettings] = useState(false);
  const tabs = [
    { id: "resume",    label: "Resume" },
    { id: "cover",     label: "Cover Letter" },
    { id: "jobs",      label: "Jobs" },
    { id: "interview", label: "Interview Prep" },
    { id: "tracker",   label: "Tracker" },
    { id: "tools",     label: "AI Tools" },
  ];

  return (
    <nav className="main-nav">
      <div className="nav-logo" onClick={() => { resetApp(); setTab("resume"); }}>Lumira</div>
      <div className="nav-center">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`nav-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="nav-icon">{NAV_ICONS[t.id]}</span>{t.label}
          </button>
        ))}
      </div>
      <div className="nav-right">
        <button
          className={`settings-btn ${showSettings ? "open" : ""}`}
          onClick={() => setShowSettings(v => !v)}
          title="Settings"
        >
          ⚙
        </button>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} theme={theme} setTheme={setTheme} />}
    </nav>
  );
}

// ── SCORE METER ───────────────────────────────────────────────────────────────
function ScoreMeter({ score }) {
  const color = score >= 75 ? "#30d158" : score >= 50 ? "#ffd60a" : "#ff453a";
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="score-meter">
      <svg width="140" height="140" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8"/>
        <circle cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)" }}
        />
        <text x="60" y="56" textAnchor="middle" fill="white" fontSize="22" fontWeight="800">{score}</text>
        <text x="60" y="72" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">/100</text>
      </svg>
      <p className="score-label">ATS Score</p>
    </div>
  );
}

// ── JD MATCH PANEL ────────────────────────────────────────────────────────────
function JDMatchPanel({ jd }) {
  const color = jd.verdict_color === "green" ? "#30d158" : jd.verdict_color === "yellow" ? "#ffd60a" : "#ff453a";
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (jd.match_pct / 100) * circumference;
  return (
    <div className="jd-panel reveal">
      <div className="jd-header">
        <div className="jd-circle">
          <svg width="100" height="100" viewBox="0 0 90 90">
            <circle cx="45" cy="45" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7"/>
            <circle cx="45" cy="45" r="40" fill="none" stroke={color} strokeWidth="7"
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round" transform="rotate(-90 45 45)"
              style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1) 0.3s" }}
            />
            <text x="45" y="41" textAnchor="middle" fill="white" fontSize="18" fontWeight="800">{jd.match_pct}%</text>
            <text x="45" y="55" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8">match</text>
          </svg>
        </div>
        <div className="jd-verdict">
          <span className="verdict-badge" style={{ color, borderColor: color }}>{jd.verdict}</span>
          <p>{jd.matched_keywords.length} of {jd.total_jd_keywords} job keywords found in your resume</p>
        </div>
      </div>
      {jd.missing_keywords.length > 0 && (
        <div className="jd-missing">
          <h4>Missing Keywords</h4>
          <div className="keyword-chips">
            {jd.missing_keywords.map((kw, i) => <span key={i} className="chip chip-missing">{kw}</span>)}
          </div>
        </div>
      )}
      {jd.matched_keywords.length > 0 && (
        <div className="jd-matched">
          <h4>Matched Keywords</h4>
          <div className="keyword-chips">
            {jd.matched_keywords.map((kw, i) => <span key={i} className="chip chip-matched">{kw}</span>)}
          </div>
        </div>
      )}
      {jd.suggestions.length > 0 && (
        <div className="jd-suggestions">
          <h4>Quick Wins</h4>
          <ul>{jd.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// ── BULLET REWRITER ───────────────────────────────────────────────────────────
function BulletRewriter({ bullets, jobContext }) {
  const [selected, setSelected] = useState(null);
  const [rewriting, setRewriting] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const rewrite = async (bullet) => {
    setSelected(bullet); setRewriting(true); setResult(null); setCopied(false);
    try {
      const res = await fetch(`${API}/rewrite-bullet/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bullet, job_context: jobContext || "" }),
      });
      setResult(await res.json());
    } catch {
      setResult({ rewritten: "Failed to rewrite. Try again.", explanation: "" });
    } finally { setRewriting(false); }
  };

  const copy = () => {
    navigator.clipboard.writeText(result.rewritten);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bullet-rewriter reveal">
      <div className="rewriter-intro">
        <span className="rewriter-badge">AI Rewriter</span>
        <p>Click any weak bullet below to instantly improve it with strong action verbs, metrics, and ATS keywords.</p>
      </div>
      <div className="bullet-list">
        {bullets.map((b, i) => (
          <button key={i} className={`bullet-item ${selected === b ? "selected" : ""}`} onClick={() => rewrite(b)}>
            <span className="bullet-weak-tag">weak</span>
            <span className="bullet-text">{b}</span>
            <span className="bullet-arrow">→</span>
          </button>
        ))}
      </div>
      {(rewriting || result) && (
        <div className="rewrite-result">
          {rewriting ? (
            <div className="rewrite-loading"><span className="spinner" /> Rewriting with AI…</div>
          ) : result && (
            <>
              <div className="rewrite-original"><span className="tag tag-before">Before</span><p>{selected}</p></div>
              <div className="rewrite-arrow-down">↓</div>
              <div className="rewrite-improved">
                <span className="tag tag-after">After</span>
                <p>{result.rewritten}</p>
                <button className="copy-btn" onClick={copy}>{copied ? "✓ Copied!" : "Copy"}</button>
              </div>
              {result.explanation && <p className="rewrite-explanation">{result.explanation}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── JOBS TAB ──────────────────────────────────────────────────────────────────
const INDUSTRIES = [
  "Technology","Healthcare","Education","Finance","Legal",
  "Marketing","Sales","Design & Creative","Human Resources",
  "Supply Chain","Engineering","Government","Research & Science",
  "Retail & Hospitality","Business",
];
const INDUSTRY_COLORS = {
  "Technology":          "#0a84ff",
  "Healthcare":          "#30d158",
  "Education":           "#ff9f0a",
  "Finance":             "#5ac8fa",
  "Legal":               "#ffd60a",
  "Marketing":           "#ff2d55",
  "Sales":               "#ff6b6b",
  "Design & Creative":   "#bf5af2",
  "Human Resources":     "#5e5ce6",
  "Supply Chain":        "#ffcc00",
  "Engineering":         "#8e8e93",
  "Government":          "#64d2ff",
  "Research & Science":  "#32ade6",
  "Retail & Hospitality":"#ff375f",
  "Business":            "#aeaeb2",
  "Other":               "#636366",
};
const EXP_COLORS = {
  "Entry Level": "#30d158",
  "Mid Level":   "#0a84ff",
  "Senior":      "#ff9f0a",
  "Executive":   "#ffd60a",
};

function getSource(url) {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    const known = {
      "linkedin.com":"LinkedIn","indeed.com":"Indeed","glassdoor.com":"Glassdoor",
      "ziprecruiter.com":"ZipRecruiter","monster.com":"Monster","dice.com":"Dice",
      "greenhouse.io":"Greenhouse","lever.co":"Lever","workday.com":"Workday",
      "myworkdayjobs.com":"Workday","icims.com":"iCIMS","smartrecruiters.com":"SmartRecruiters",
      "careers.google.com":"Google","jobs.apple.com":"Apple","amazon.jobs":"Amazon","microsoft.com":"Microsoft",
    };
    return known[host] || host;
  } catch { return "Job Board"; }
}

function formatEmploymentType(t) {
  if (!t) return null;
  return { FULLTIME:"Full-time", PARTTIME:"Part-time", CONTRACTOR:"Contract", INTERN:"Internship" }[t.toUpperCase()] || t;
}

const CACHE_KEY = "ltr_jobs_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function SkeletonJobCard() {
  return (
    <div className="li-job-card skeleton-card" style={{ pointerEvents: "none" }}>
      <div className="li-card-top">
        <div className="skeleton-line" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="skeleton-line" style={{ width: "55%", height: "17px", marginBottom: "8px" }} />
          <div className="skeleton-line" style={{ width: "38%", height: "13px", marginBottom: "6px" }} />
          <div className="skeleton-line" style={{ width: "28%", height: "12px" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <div className="skeleton-line" style={{ width: 60, height: 18, borderRadius: 4 }} />
        <div className="skeleton-line" style={{ width: 50, height: 18, borderRadius: 4 }} />
        <div className="skeleton-line" style={{ width: 55, height: 18, borderRadius: 4 }} />
      </div>
    </div>
  );
}

// ── COMPANY AVATAR ─────────────────────────────────────────────────────────────
function CompanyAvatar({ name, size = 44 }) {
  const initials = name
    ? name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
    : "?";
  const hue = name ? [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360 : 200;
  return (
    <div
      className="company-avatar"
      style={{
        width: size, height: size,
        background: `hsl(${hue},45%,28%)`,
        border: `1px solid hsl(${hue},45%,38%)`,
      }}
    >
      <span style={{ color: `hsl(${hue},70%,72%)`, fontSize: size * 0.38, fontWeight: 800 }}>
        {initials}
      </span>
    </div>
  );
}

function JobsTab({ onPrepInterview }) {
  const [country, setCountry]       = useState("US");
  const [query, setQuery]           = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [jobs, setJobs]             = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [retryMsg, setRetryMsg]     = useState(null);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(false);
  const [expanded, setExpanded]     = useState(null);
  const [filters, setFilters] = useState({
    industry: "", jobType: "", expLevel: "", dateRange: "all", remote: false, stateFilter: "",
  });
  const abortRef = useRef(null);

  // Load from cache on mount
  useEffect(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (cached && Date.now() - cached.ts < CACHE_TTL && cached.country === "US") {
        setJobs(cached.jobs);
        setHasMore(cached.hasMore);
        setPage(cached.page);
      }
    } catch {}
  }, []);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  const fetchWithRetry = async (url, signal, retries = 3) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, { signal });
        if (res.ok) return res;
        if (res.status < 500 || attempt === retries) return res;
        setRetryMsg(`Server warming up… (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, (attempt + 1) * 3000));
      } catch (e) {
        if (e.name === "AbortError") throw e;
        if (attempt === retries) throw e;
        setRetryMsg(`Retrying… (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, (attempt + 1) * 3000));
      }
    }
  };

  const fetchJobs = useCallback(async (c, kw, pg, f = filters) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (pg === 1) setJobs([]);
    setLoading(true);
    setError(null);
    setRetryMsg(null);
    try {
      const params = new URLSearchParams({ country: c, page: pg, per_page: 20 });
      if (kw.trim())             params.set("keyword", kw.trim());
      if (f.industry)            params.set("industry", f.industry);
      if (f.jobType)             params.set("job_type", f.jobType);
      if (f.expLevel)            params.set("experience_level", f.expLevel);
      if (f.dateRange !== "all") params.set("date_range", f.dateRange);
      if (f.remote)              params.set("remote", "true");
      if (f.stateFilter.trim())  params.set("state_filter", f.stateFilter.trim());
      const res = await fetchWithRetry(`${API}/jobs/?${params}`, controller.signal);
      if (!res || controller.signal.aborted) return;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      const newJobs = pg === 1 ? (data.jobs || []) : null;
      if (pg === 1) {
        setJobs(data.jobs || []);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            jobs: data.jobs || [], hasMore: data.has_more === true,
            page: pg, ts: Date.now(), country: c,
          }));
        } catch {}
      } else {
        setJobs(prev => [...prev, ...(data.jobs || [])]);
      }
      setHasMore(data.has_more === true);
      setPage(pg);
    } catch (e) {
      if (e.name === "AbortError") return;
      const isColdStart = e.message.toLowerCase().includes("fetch") ||
                          e.message.toLowerCase().includes("network") ||
                          e.message.toLowerCase().includes("failed");
      setError(isColdStart ? "cold_start" : e.message);
    } finally {
      setRetryMsg(null);
      setLoading(false);
    }
  }, [filters]);

  // Initial load + country switch
  useEffect(() => { fetchJobs(country, "", 1); }, [country]);

  // Debounced search — fires 400 ms after query stops changing
  useEffect(() => {
    if (!query) return;
    const t = setTimeout(() => fetchJobs(country, query, 1), 400);
    return () => clearTimeout(t);
  }, [query]);

  const search = () => {
    const next = { ...filters, stateFilter: locationQuery };
    setFilters(next);
    fetchJobs(country, query, 1, next);
  };

  const applyFilter = (key, val) => {
    const next = { ...filters, [key]: val };
    setFilters(next);
    fetchJobs(country, query, 1, next);
  };

  const clearFilters = () => {
    const reset = { industry: "", jobType: "", expLevel: "", dateRange: "all", remote: false, stateFilter: "" };
    setFilters(reset);
    setLocationQuery("");
    fetchJobs(country, query, 1, reset);
  };

  const hasActiveFilters = filters.industry || filters.jobType || filters.expLevel ||
                           filters.dateRange !== "all" || filters.remote || filters.stateFilter;

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 3600000);
    if (diff < 1)  return "Just now";
    if (diff < 24) return `${diff}h ago`;
    const d = Math.floor(diff / 24);
    if (d < 7)     return `${d}d ago`;
    return `${Math.floor(d / 7)}w ago`;
  };

  return (
    <div className="jobs-page">
      {/* ── Sticky search bar ── */}
      <div className="jobs-search-bar">
        <input
          className="jobs-search-input"
          placeholder="Job title, skill, or keyword…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
        />
        <input
          className="jobs-location-input"
          placeholder="Location (e.g. CA, Texas)"
          value={locationQuery}
          onChange={e => setLocationQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
        />
        <button className="jobs-search-btn" onClick={search}>Search</button>
        <div className="jobs-country-pills">
          {[["US","🇺🇸 US"],["IN","🇮🇳 India"]].map(([code, label]) => (
            <button
              key={code}
              className={`jobs-country-pill${country === code ? " active" : ""}`}
              onClick={() => { setCountry(code); setQuery(""); setLocationQuery(""); }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div className="jobs-body">

        {/* Left sidebar */}
        <aside className="jobs-sidebar">
          <div className="jobs-sidebar-title">
            <span>Filters</span>
            {hasActiveFilters && (
              <button className="jobs-sidebar-clear" onClick={clearFilters}>Clear all</button>
            )}
          </div>

          {/* Job Type */}
          <div className="jobs-filter-section">
            <span className="jobs-filter-label">Job Type</span>
            <div className="jobs-filter-chips">
              {[["FULLTIME","Full-time"],["PARTTIME","Part-time"],["CONTRACTOR","Contract"],["INTERN","Internship"]].map(([val, label]) => (
                <button
                  key={val}
                  className={`jobs-filter-chip${filters.jobType === val ? " active" : ""}`}
                  onClick={() => applyFilter("jobType", filters.jobType === val ? "" : val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Experience */}
          <div className="jobs-filter-section">
            <span className="jobs-filter-label">Experience</span>
            <div className="jobs-filter-chips">
              {[["Entry Level","Entry"],["Mid Level","Mid"],["Senior","Senior"],["Executive","Executive"]].map(([val, label]) => (
                <button
                  key={val}
                  className={`jobs-filter-chip${filters.expLevel === val ? " active" : ""}`}
                  onClick={() => applyFilter("expLevel", filters.expLevel === val ? "" : val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Posted */}
          <div className="jobs-filter-section">
            <span className="jobs-filter-label">Date Posted</span>
            <div className="jobs-filter-chips">
              {[["all","Any"],["24h","Past 24h"],["7d","Past week"],["30d","Past month"]].map(([val, label]) => (
                <button
                  key={val}
                  className={`jobs-filter-chip${filters.dateRange === val ? " active" : ""}`}
                  onClick={() => applyFilter("dateRange", val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Remote Only toggle */}
          <div className="jobs-filter-section">
            <span className="jobs-filter-label">Work Mode</span>
            <div className="jobs-remote-row">
              <span className="jobs-remote-label">Remote Only</span>
              <label className="jobs-toggle-switch">
                <input
                  type="checkbox"
                  checked={filters.remote}
                  onChange={() => applyFilter("remote", !filters.remote)}
                />
                <span className="jobs-toggle-track" />
                <span className="jobs-toggle-thumb" />
              </label>
            </div>
          </div>
        </aside>

        {/* Right main */}
        <main className="jobs-main">

          {/* Mobile horizontal filter row */}
          <div className="jobs-mobile-filters">
            {[["FULLTIME","Full-time"],["PARTTIME","Part-time"],["CONTRACTOR","Contract"],["INTERN","Internship"]].map(([val, label]) => (
              <button
                key={val}
                className={`jobs-filter-chip${filters.jobType === val ? " active" : ""}`}
                onClick={() => applyFilter("jobType", filters.jobType === val ? "" : val)}
              >
                {label}
              </button>
            ))}
            {[["Entry Level","Entry"],["Mid Level","Mid"],["Senior","Senior"]].map(([val, label]) => (
              <button
                key={val}
                className={`jobs-filter-chip${filters.expLevel === val ? " active" : ""}`}
                onClick={() => applyFilter("expLevel", filters.expLevel === val ? "" : val)}
              >
                {label}
              </button>
            ))}
            <button
              className={`jobs-filter-chip${filters.remote ? " active" : ""}`}
              onClick={() => applyFilter("remote", !filters.remote)}
            >
              Remote
            </button>
          </div>

          {retryMsg && (
            <p style={{ textAlign: "center", padding: "10px 0", opacity: 0.7, fontSize: 13, color: "var(--text-dim)" }}>
              ⏳ {retryMsg}
            </p>
          )}

          {error === "cold_start" ? (
            <div className="jobs-empty" style={{ padding: "40px 0" }}>
              <p style={{ fontSize: "1.1rem", marginBottom: "8px" }}>⏳ Server is waking up…</p>
              <p style={{ opacity: 0.6, marginBottom: "20px" }}>This can take up to 60 seconds on first load. Please wait or retry.</p>
              <button className="load-more-btn" onClick={() => fetchJobs(country, query, 1)}>Retry</button>
            </div>
          ) : error ? (
            <div className="jobs-empty" style={{ padding: "40px 0" }}>
              <p style={{ fontSize: "1rem", marginBottom: "16px", color: "#ff453a" }}>⚠ {error}</p>
              <button className="load-more-btn" onClick={() => fetchJobs(country, query, 1)}>Retry</button>
            </div>
          ) : null}

          {!error && (loading && jobs.length === 0 ? (
            <div>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonJobCard key={i} />)}
            </div>
          ) : jobs.length === 0 && !loading ? (
            <div className="jobs-empty">No jobs found. Try adjusting your filters or search terms.</div>
          ) : (
            <>
              {jobs.length > 0 && (
                <p className="jobs-result-count">
                  {jobs.length} job{jobs.length !== 1 ? "s" : ""} found{hasActiveFilters ? " · filtered" : ""}
                </p>
              )}
              {jobs.map(job => {
                const indColor = INDUSTRY_COLORS[job.industry] || "#636366";
                const expColor = EXP_COLORS[job.experience_level] || "#aeaeb2";
                const empType = formatEmploymentType(job.employment_type);
                const timeAgo = job.posted_at ? formatDate(job.posted_at) : null;
                const isExpanded = expanded === job.job_id;
                return (
                  <div
                    key={job.job_id}
                    className={`li-job-card${isExpanded ? " active" : ""}`}
                    onClick={() => setExpanded(isExpanded ? null : job.job_id)}
                  >
                    <div className="li-card-top">
                      <CompanyAvatar name={job.company} size={44} />
                      <div className="li-card-info">
                        <div className="li-job-title">{job.title || "Untitled"}</div>
                        <div className="li-job-company">{job.company || "Company not listed"}</div>
                        {job.location && <div className="li-job-location">{job.location}</div>}
                      </div>
                      {timeAgo && <span className="li-time">{timeAgo}</span>}
                    </div>

                    <div className="li-card-meta">
                      {job.industry && job.industry !== "Other" && (
                        <span className="li-badge" style={{ color: indColor, background: `${indColor}14`, borderColor: `${indColor}35` }}>{job.industry}</span>
                      )}
                      {empType && (
                        <span className="li-badge" style={{ color: "var(--text-muted)", background: "var(--surface2)", borderColor: "var(--border)" }}>{empType}</span>
                      )}
                      {job.experience_level && (
                        <span className="li-badge" style={{ color: expColor, background: `${expColor}14`, borderColor: `${expColor}35` }}>{job.experience_level}</span>
                      )}
                      {job.is_remote && (
                        <span className="li-badge" style={{ color: "#30d158", background: "rgba(48,209,88,0.1)", borderColor: "rgba(48,209,88,0.3)" }}>Remote</span>
                      )}
                    </div>

                    <div className="li-card-actions" onClick={e => e.stopPropagation()}>
                      {job.url ? (
                        <a className="li-apply-btn" href={job.url} target="_blank" rel="noopener noreferrer">Easy Apply</a>
                      ) : (
                        <span className="li-apply-btn apply-na">No Link</span>
                      )}
                      <button className="li-prep-btn" onClick={() => onPrepInterview(job.title, job.company)}>
                        Prep Interview
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="li-description" onClick={e => e.stopPropagation()}>
                        {job.description || "No description available."}
                      </div>
                    )}
                  </div>
                );
              })}
              {hasMore && (
                <div style={{ textAlign: "center", marginTop: "24px" }}>
                  <button className="load-more-btn" onClick={e => { e.stopPropagation(); fetchJobs(country, query, page + 1); }} disabled={loading}>
                    {loading ? <><span className="spinner" /> Loading…</> : "Load More Jobs"}
                  </button>
                </div>
              )}
            </>
          ))}
        </main>
      </div>
    </div>
  );
}

// ── INTERVIEW TAB ─────────────────────────────────────────────────────────────
function InterviewPage({ prefillTitle, prefillCompany }) {
  const [jd, setJd] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [numQ, setNumQ] = useState(10);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState(null);
  const [roleSummary, setRoleSummary] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [activeQ, setActiveQ] = useState(null);
  const [answers, setAnswers] = useState({});
  const [evaluations, setEvaluations] = useState({});
  const [evaluating, setEvaluating] = useState({});

  const generate = async () => {
    if (!jd.trim() || jd.trim().length < 50) return alert("Please paste a job description (at least 50 characters)");
    setLoading(true); setQuestions(null); setEvaluations({}); setAnswers({});
    try {
      const res = await fetch(`${API}/generate-interview/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_description: jd, resume_text: resumeText, num_questions: numQ }),
      });
      const data = await res.json();
      setQuestions(data.questions || []);
      setRoleSummary(data.role_summary || "");
      setDifficulty(data.difficulty || "");
    } catch { alert("Failed to generate questions. Try again."); }
    finally { setLoading(false); }
  };

  const evaluate = async (q) => {
    const answer = answers[q.id];
    if (!answer || answer.trim().length < 10) return alert("Write at least a sentence before evaluating!");
    setEvaluating(prev => ({ ...prev, [q.id]: true }));
    try {
      const res = await fetch(`${API}/evaluate-answer/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.question, answer, job_description: jd, resume_text: resumeText }),
      });
      const data = await res.json();
      setEvaluations(prev => ({ ...prev, [q.id]: data }));
    } catch { alert("Evaluation failed. Try again."); }
    finally { setEvaluating(prev => ({ ...prev, [q.id]: false })); }
  };

  const typeColors = { technical: "#0a84ff", behavioral: "#30d158", situational: "#ffd60a", culture: "#bf5af2" };
  const scoreColor = (s) => s >= 80 ? "#30d158" : s >= 60 ? "#ffd60a" : "#ff453a";

  return (
    <div className="interview-page">
      <div className="page-banner">
        <h2>🎤 Interview Prep</h2>
        <p>Get tailored questions from any job description. Practice your answers and get AI feedback.</p>
      </div>
      <div className="interview-inner">
      {!questions ? (
        <div className="interview-setup">
          {prefillTitle && (
            <div className="prefill-banner">
              Prepped for: <strong>{prefillTitle}</strong>{prefillCompany ? ` at ${prefillCompany}` : ""}
            </div>
          )}
          <label className="field-label">Job Description *</label>
          <textarea
            className="interview-textarea"
            placeholder="Paste the full job description here…"
            value={jd}
            onChange={e => setJd(e.target.value)}
            rows={8}
          />
          <label className="field-label">Your Resume (optional, for personalized questions)</label>
          <textarea
            className="interview-textarea"
            placeholder="Paste your resume text here for personalized questions…"
            value={resumeText}
            onChange={e => setResumeText(e.target.value)}
            rows={4}
          />
          <div className="num-questions">
            <label className="field-label">Number of Questions</label>
            <div className="num-btns">
              {[5, 10, 15, 20].map(n => (
                <button key={n} className={numQ === n ? "active" : ""} onClick={() => setNumQ(n)}>{n}</button>
              ))}
            </div>
          </div>
          <button className="analyze-btn" onClick={generate} disabled={loading}>
            {loading ? <><span className="spinner" /> Generating Questions…</> : "Generate Interview Questions"}
          </button>
        </div>
      ) : (
        <div className="interview-results">
          <div className="interview-meta reveal">
            <div className="meta-card">
              <span className="meta-label">Role Summary</span>
              <p>{roleSummary}</p>
            </div>
            <div className="meta-card">
              <span className="meta-label">Difficulty</span>
              <span className="difficulty-badge">{difficulty}</span>
            </div>
            <button className="reset-btn" onClick={() => setQuestions(null)}>← New JD</button>
          </div>

          <div className="questions-list">
            {questions.map((q, i) => (
              <div key={q.id} className={`question-card reveal ${activeQ === q.id ? "expanded" : ""}`}>
                <div className="question-header" onClick={() => setActiveQ(activeQ === q.id ? null : q.id)}>
                  <div className="question-left">
                    <span className="q-num">Q{i + 1}</span>
                    <span className="q-type" style={{ color: typeColors[q.type] || "#fff", borderColor: typeColors[q.type] || "#fff" }}>
                      {q.type}
                    </span>
                    <p className="q-text">{q.question}</p>
                  </div>
                  <span className="q-toggle">{activeQ === q.id ? "▲" : "▼"}</span>
                </div>

                {activeQ === q.id && (
                  <div className="question-body">
                    <div className="why-asked">
                      <span className="why-label">Why they ask this:</span>
                      <p>{q.why_asked}</p>
                    </div>
                    <div className="hints">
                      <span className="hints-label">Good answer should include:</span>
                      <ul>{(q.good_answer_hints || []).map((h, j) => <li key={j}>{h}</li>)}</ul>
                    </div>
                    <div className="answer-section">
                      <label className="field-label">Your Answer</label>
                      <textarea
                        className="answer-textarea"
                        placeholder="Type your answer here and get instant AI feedback…"
                        value={answers[q.id] || ""}
                        onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        rows={5}
                      />
                      <button className="evaluate-btn" onClick={() => evaluate(q)} disabled={evaluating[q.id]}>
                        {evaluating[q.id] ? <><span className="spinner" /> Evaluating…</> : "Get AI Feedback"}
                      </button>
                    </div>

                    {evaluations[q.id] && (
                      <div className="evaluation-result">
                        <div className="eval-score">
                          <span className="score-num" style={{ color: scoreColor(evaluations[q.id].score) }}>
                            {evaluations[q.id].score}/100
                          </span>
                          <span className="score-label-sm">Answer Score</span>
                        </div>
                        <div className="eval-feedback">
                          <h5>Feedback</h5>
                          <p>{evaluations[q.id].feedback}</p>
                        </div>
                        {evaluations[q.id].keywords_used?.length > 0 && (
                          <div className="eval-keywords">
                            <h5>Keywords Used Well</h5>
                            <div className="keyword-chips">
                              {evaluations[q.id].keywords_used.map((k, j) => <span key={j} className="chip chip-matched">{k}</span>)}
                            </div>
                          </div>
                        )}
                        {evaluations[q.id].keywords_missing?.length > 0 && (
                          <div className="eval-keywords">
                            <h5>Keywords to Add</h5>
                            <div className="keyword-chips">
                              {evaluations[q.id].keywords_missing.map((k, j) => <span key={j} className="chip chip-missing">{k}</span>)}
                            </div>
                          </div>
                        )}
                        <div className="eval-improved">
                          <h5>Improved Answer</h5>
                          <p>{evaluations[q.id].improved_answer}</p>
                          <button className="copy-btn" onClick={() => navigator.clipboard.writeText(evaluations[q.id].improved_answer)}>
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      </div>{/* /interview-inner */}
    </div>
  );
}

// ── RESUME PAGE ───────────────────────────────────────────────────────────────
const HISTORY_KEY = "ltr_history";

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}
function saveToHistory(file, result) {
  const history = loadHistory();
  const entry = {
    id: Date.now(),
    name: file.name,
    score: result.ats_score,
    date: new Date().toLocaleDateString(),
    result,
  };
  const updated = [entry, ...history].slice(0, 10);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}

function ResumePage() {
  const [file, setFile]           = useState(null);
  const [jdText, setJdText]       = useState("");
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [jdExpanded, setJdExpanded] = useState(false);
  const [history, setHistory]     = useState(loadHistory);
  const [copied, setCopied]       = useState(false);

  const handleFileChange = (e) => { setFile(e.target.files[0]); setError(null); };

  const handleUpload = async () => {
    if (!file) { setError("Please select a PDF file first."); return; }
    setLoading(true); setError(null);
    const formData = new FormData();
    formData.append("file", file);
    if (jdText.trim()) formData.append("job_description", jdText.trim());

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 1) setError(`⏳ Server is waking up… (attempt ${attempt}/${MAX_RETRIES})`);
        const res = await fetch(`${API}/analyze-resume/`, { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to analyze resume");
        setError(null);
        setResult(data);
        setHistory(saveToHistory(file, data));
        window.scrollTo({ top: 0, behavior: "smooth" });
        setLoading(false);
        return;
      } catch (err) {
        const isColdStart = err.message.toLowerCase().includes("fetch") ||
                            err.message.toLowerCase().includes("network") ||
                            err.message.toLowerCase().includes("failed to fetch");
        if (isColdStart && attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, attempt * 8000));
          continue;
        }
        setError(isColdStart
          ? "⏳ Server is still waking up. Please wait 30 seconds and try again."
          : err.message);
        break;
      }
    }
    setLoading(false);
  };

  const resetApp = () => { setResult(null); setFile(null); setError(null); setJdText(""); setJdExpanded(false); };

  const deleteHistory = (id) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const copyReport = () => {
    if (!result) return;
    const text = [
      `ATS Score: ${result.ats_score}/100`,
      `\nSummary:\n${result.summary_feedback}`,
      `\nStrengths:\n${(result.strengths||[]).map(s=>`• ${s}`).join('\n')}`,
      `\nWeaknesses:\n${(result.weaknesses||[]).map(w=>`• ${w}`).join('\n')}`,
      `\nMissing Skills:\n${(result.missing_skills||[]).map(s=>`• ${s}`).join('\n')}`,
      `\nRecommendations:\n${(result.recommendations||[]).map(r=>`• ${r}`).join('\n')}`,
    ].join('');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPDF = () => { window.print(); };

  useEffect(() => {
    if (!result) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in-view"); }),
      { threshold: 0.08 }
    );
    const timer = setTimeout(() => {
      document.querySelectorAll(".reveal, .stagger-list, .score-meter").forEach((el) => observer.observe(el));
    }, 80);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [result]);

  if (!result) return (
    <div className="hero">
      <div className="card">
        <div className="logo-tag">Lumira.ai</div>
        <h1>Get Hired Faster</h1>
        <p>Upload your resume and get a full ATS score, keyword gap analysis, and bullet rewrites.</p>
        <div className="upload-row">
          <label className="file-label">
            <input type="file" accept=".pdf" onChange={handleFileChange} />
            <span className="file-btn">{file ? file.name : "Choose Resume PDF"}</span>
          </label>
        </div>
        <div className="jd-toggle">
          <button className="jd-toggle-btn" onClick={() => setJdExpanded(!jdExpanded)}>
            {jdExpanded ? "▲ Hide" : "▼ Add"} Job Description <span className="jd-badge">+Match %</span>
          </button>
        </div>
        {jdExpanded && (
          <div className="jd-input-area">
            <textarea
              placeholder="Paste the job description here to get a keyword match score and tailored suggestions…"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              rows={6}
            />
            <p className="jd-hint">{jdText.length > 0 ? `${jdText.split(/\s+/).filter(Boolean).length} words pasted` : "Tip: paste the full JD for best results"}</p>
          </div>
        )}
        <button className="analyze-btn" onClick={handleUpload} disabled={loading}>
          {loading && <span className="spinner" />}
          {loading ? "Analyzing…" : "Analyze My Resume"}
        </button>
        <div className="feature-pills">
          <span>◆ ATS Score</span>
          <span>◆ JD Match %</span>
          <span>◆ AI Rewrites</span>
          <span>◆ History</span>
        </div>
        {error && <p className="error-msg">{error}</p>}
      </div>
      {history.length > 0 && (
        <div className="history-section">
          <div className="history-title">📂 Recent Analyses</div>
          <div className="history-list">
            {history.map(h => {
              const scoreColor = h.score >= 75 ? "#30d158" : h.score >= 50 ? "#ffd60a" : "#ff453a";
              return (
                <div key={h.id} className="history-item" onClick={() => setResult(h.result)}>
                  <div className="history-info">
                    <div className="history-name">{h.name}</div>
                    <div className="history-meta">{h.date}</div>
                  </div>
                  <div className="history-score" style={{ color: scoreColor }}>{h.score}</div>
                  <button className="history-del" onClick={e => { e.stopPropagation(); deleteHistory(h.id); }} title="Remove">✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FEATURE CARDS ── */}
      <div className="landing-features">
        <div className="landing-section-label">Everything you need to land the role</div>
        <div className="feature-cards">
          <div className="feature-card">
            <div className="feature-card-icon">📄</div>
            <div className="feature-card-title">Resume Scorer</div>
            <div className="feature-card-desc">Instant ATS score, keyword gap analysis, and AI bullet rewrites. Know exactly what's holding you back.</div>
            <div className="feature-card-chips">
              <span>ATS Score</span><span>JD Match</span><span>AI Rewrites</span>
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">✉️</div>
            <div className="feature-card-title">Cover Letter AI</div>
            <div className="feature-card-desc">Generate tailored, professional cover letters in seconds. Choose from formal, confident, or creative tone.</div>
            <div className="feature-card-chips">
              <span>3 Tones</span><span>Instant</span><span>Tailored</span>
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">🎯</div>
            <div className="feature-card-title">Application Tracker</div>
            <div className="feature-card-desc">Kanban board to track every application from Applied → Interview → Offer. Never lose track again.</div>
            <div className="feature-card-chips">
              <span>Kanban</span><span>Notes</span><span>Saved Locally</span>
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">🤖</div>
            <div className="feature-card-title">AI Tools Suite</div>
            <div className="feature-card-desc">LinkedIn optimizer, cold email generator, skill gap analyzer, and salary estimator.</div>
            <div className="feature-card-chips">
              <span>LinkedIn</span><span>Cold Email</span><span>Salary Est.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div className="landing-how">
        <div className="landing-section-label">How it works</div>
        <div className="how-steps">
          <div className="how-step">
            <div className="how-step-num">1</div>
            <div className="how-step-title">Upload Your Resume</div>
            <div className="how-step-desc">Drop your PDF above. No account needed.</div>
          </div>
          <div className="how-step-arrow">→</div>
          <div className="how-step">
            <div className="how-step-num">2</div>
            <div className="how-step-title">Get Your AI Report</div>
            <div className="how-step-desc">ATS score, strengths, weaknesses, and keyword gaps in under 10 seconds.</div>
          </div>
          <div className="how-step-arrow">→</div>
          <div className="how-step">
            <div className="how-step-num">3</div>
            <div className="how-step-title">Land the Interview</div>
            <div className="how-step-desc">Apply fixes, generate your cover letter, and track every application.</div>
          </div>
        </div>
      </div>
    </div>
  );

  // Word count from ATS breakdown heuristic
  const wordCountEstimate = result.ats_breakdown?.length_format?.word_count;
  const pageEstimate = wordCountEstimate ? (wordCountEstimate <= 550 ? "~1 page ✓" : wordCountEstimate <= 900 ? "~1–2 pages" : "2+ pages, consider trimming") : null;

  return (
    <div className="results-section">
      <div className="results-top reveal">
        <ScoreMeter score={result.ats_score} />
        <div className="results-summary">
          <h2>Your Resume Analysis</h2>
          <p>{result.summary_feedback}</p>
          {pageEstimate && (
            <div className="wordcount-badge">📄 <strong>{wordCountEstimate} words</strong> · {pageEstimate}</div>
          )}
          <div className="report-actions">
            <button className="report-btn" onClick={copyReport}>{copied ? "✓ Copied!" : "📋 Copy Report"}</button>
            <button className="report-btn" onClick={downloadPDF}>🖨 Download PDF</button>
          </div>
        </div>
      </div>
      {result.ats_breakdown && (<><h3 className="reveal">Score Breakdown</h3><ATSBreakdown breakdown={result.ats_breakdown} /></>)}
      {result.jd_match && (<><h3 className="reveal">Job Description Match</h3><JDMatchPanel jd={result.jd_match} /></>)}
      <h3 className="reveal">Strengths</h3>
      <ul className="strengths stagger-list">{(result.strengths || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
      <h3 className="reveal">Weaknesses</h3>
      <ul className="weaknesses stagger-list">{(result.weaknesses || []).map((w, i) => <li key={i}>{w}</li>)}</ul>
      {result.weak_bullets?.length > 0 && (<><h3 className="reveal">Rewrite Weak Bullets</h3><BulletRewriter bullets={result.weak_bullets} jobContext={jdText} /></>)}
      <h3 className="reveal">Missing Skills</h3>
      <ul className="stagger-list">{(result.missing_skills || []).map((m, i) => <li key={i}>{m}</li>)}</ul>
      <h3 className="reveal">Recommendations</h3>
      <ul className="stagger-list">{(result.recommendations || []).map((r, i) => <li key={i}>{r}</li>)}</ul>
      <div className="reveal" style={{ marginTop: "56px", textAlign: "center" }}>
        <button className="analyze-btn" onClick={resetApp}>Analyze Another Resume</button>
      </div>
    </div>
  );
}

// ── COVER LETTER PAGE ─────────────────────────────────────────────────────────
function CoverLetterPage() {
  const [resumeText, setResumeText] = useState("");
  const [jd, setJd]               = useState("");
  const [tone, setTone]           = useState("professional");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);
  const [copied, setCopied]       = useState(false);

  const tones = ["professional", "enthusiastic", "concise", "creative"];

  const generate = async () => {
    if (resumeText.trim().length < 100) return setError("Please paste more of your resume (at least 100 characters).");
    if (jd.trim().length < 50) return setError("Please paste a job description (at least 50 characters).");
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${API}/generate-cover-letter/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text: resumeText, job_description: jd, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to generate");
      setResult(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const copy = () => {
    navigator.clipboard.writeText(result.cover_letter);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="cover-page">
      <div className="page-banner">
        <h2>✉ Cover Letter Generator</h2>
        <p>Paste your resume + job description and get a tailored cover letter in seconds</p>
      </div>
      <div className="cover-layout">
        {/* LEFT — form */}
        <div className="cover-form-col">
          <div>
            <label className="field-label">Your Resume Text *</label>
            <textarea className="interview-textarea" rows={7} placeholder="Paste your resume text here…" value={resumeText} onChange={e => setResumeText(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Job Description *</label>
            <textarea className="interview-textarea" rows={6} placeholder="Paste the full job description…" value={jd} onChange={e => setJd(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Tone</label>
            <div className="tone-picker">
              {tones.map(t => (
                <button key={t} className={`tone-btn ${tone === t ? "active" : ""}`} onClick={() => setTone(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="analyze-btn" onClick={generate} disabled={loading}>
            {loading ? <><span className="spinner" /> Generating…</> : "✨ Generate Cover Letter"}
          </button>
        </div>
        {/* RIGHT — result */}
        <div className="cover-result-col">
          {!result ? (
            <div className="cover-result-placeholder">
              <span>✉</span>
              Your cover letter will appear here.<br/>Fill in the form and click Generate.
            </div>
          ) : (
            <>
              <div className="cover-letter-box">
                <button className="tool-copy-btn" onClick={copy}>{copied ? "✓" : "Copy"}</button>
                {result.cover_letter}
              </div>
              {result.highlights?.length > 0 && (
                <div className="highlights-row">
                  {result.highlights.map((h, i) => <span key={i} className="highlight-chip">✓ {h}</span>)}
                </div>
              )}
              <div className="cover-actions">
                <button className="cover-action-btn primary" onClick={copy}>{copied ? "✓ Copied!" : "📋 Copy Letter"}</button>
                <button className="cover-action-btn" onClick={() => setResult(null)}>↺ Regenerate</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── APPLICATION TRACKER (KANBAN) ──────────────────────────────────────────────
const TRACKER_KEY = "ltr_tracker";
const STATUSES = [
  { id: "applied",   label: "Applied",   color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  { id: "interview", label: "Interview", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  { id: "offer",     label: "Offer",     color: "#10b981", bg: "rgba(16,185,129,0.15)" },
  { id: "rejected",  label: "Rejected",  color: "#ef4444", bg: "rgba(239,68,68,0.15)"  },
  { id: "ghosted",   label: "Ghosted",   color: "#6b7280", bg: "rgba(107,114,128,0.15)"},
];

function loadTracker() {
  try { return JSON.parse(localStorage.getItem(TRACKER_KEY)) || []; }
  catch { return []; }
}

const SORT_COLS = ["company","title","status","date"];

function TrackerPage() {
  const [jobs, setJobs]           = useState(loadTracker);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId]       = useState(null);
  const [sortBy, setSortBy]       = useState("date");
  const [sortDir, setSortDir]     = useState(-1);
  const [filterStatus, setFilter] = useState("all");
  const [openStatusId, setOpenStatusId] = useState(null);
  const blankForm = { title: "", company: "", url: "", notes: "", status: "applied" };
  const [form, setForm] = useState(blankForm);

  const save = (u) => { setJobs(u); localStorage.setItem(TRACKER_KEY, JSON.stringify(u)); };
  const addJob = () => {
    if (!form.title.trim() || !form.company.trim()) return;
    const entry = { ...form, id: Date.now(), date: new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) };
    save([entry, ...jobs]);
    setForm(blankForm); setShowModal(false);
  };
  const updateField = (id, key, val) => save(jobs.map(j => j.id === id ? { ...j, [key]: val } : j));
  const deleteJob   = (id) => save(jobs.filter(j => j.id !== id));
  const toggleSort  = (col) => { if (sortBy === col) setSortDir(d => -d); else { setSortBy(col); setSortDir(1); } };

  const statusOf = (id) => STATUSES.find(s => s.id === id) || STATUSES[0];

  const displayed = [...jobs]
    .filter(j => filterStatus === "all" || j.status === filterStatus)
    .sort((a, b) => {
      const av = (a[sortBy] || "").toLowerCase(), bv = (b[sortBy] || "").toLowerCase();
      return av < bv ? -sortDir : av > bv ? sortDir : 0;
    });

  const SortIcon = ({ col }) => sortBy === col
    ? <span style={{opacity:0.6, fontSize:10}}>{sortDir === 1 ? " ↑" : " ↓"}</span>
    : <span style={{opacity:0.2, fontSize:10}}> ↕</span>;

  return (
    <div className="tracker-page">
      <div className="page-banner">
        <h2>📌 Application Tracker</h2>
        <p>Track every application from first click to offer letter</p>
      </div>
      <div className="tracker-inner">

        {/* toolbar */}
        <div className="tracker-toolbar">
          <div className="tracker-filters">
            <button className={`tr-filter-btn ${filterStatus==="all"?"active":""}`} onClick={() => setFilter("all")}>All <span>{jobs.length}</span></button>
            {STATUSES.map(s => (
              <button key={s.id} className={`tr-filter-btn ${filterStatus===s.id?"active":""}`}
                style={filterStatus===s.id ? {borderColor: s.color, color: s.color, background: s.bg} : {}}
                onClick={() => setFilter(filterStatus===s.id?"all":s.id)}>
                {s.label} <span>{jobs.filter(j=>j.status===s.id).length}</span>
              </button>
            ))}
          </div>
          <button className="add-job-btn" onClick={() => setShowModal(true)}>+ New</button>
        </div>

        {/* table */}
        <div className="notion-table-wrap">
          <table className="notion-table">
            <thead>
              <tr>
                <th className="nt-th nt-check" />
                <th className="nt-th nt-company" onClick={() => toggleSort("company")}>Company <SortIcon col="company"/></th>
                <th className="nt-th" onClick={() => toggleSort("title")}>Position <SortIcon col="title"/></th>
                <th className="nt-th" onClick={() => toggleSort("status")}>Status <SortIcon col="status"/></th>
                <th className="nt-th" onClick={() => toggleSort("date")}>Date Applied <SortIcon col="date"/></th>
                <th className="nt-th">Notes</th>
                <th className="nt-th">Link</th>
                <th className="nt-th nt-actions" />
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr><td colSpan={8} className="nt-empty">No applications yet. Click <strong>+ New</strong> to add your first one.</td></tr>
              )}
              {displayed.map(job => {
                const st = statusOf(job.status);
                const isEdit = editId === job.id;
                return (
                  <tr key={job.id} className="nt-row" onClick={() => setEditId(isEdit ? null : job.id)}>
                    <td className="nt-td nt-check"><div className="nt-dot" style={{background: st.color}} /></td>
                    <td className="nt-td nt-company-cell">
                      {isEdit
                        ? <input className="nt-inline-input" value={job.company} onClick={e=>e.stopPropagation()} onChange={e=>updateField(job.id,"company",e.target.value)} />
                        : <span className="nt-company-name">{job.company}</span>}
                    </td>
                    <td className="nt-td">
                      {isEdit
                        ? <input className="nt-inline-input" value={job.title} onClick={e=>e.stopPropagation()} onChange={e=>updateField(job.id,"title",e.target.value)} />
                        : <span className="nt-text">{job.title}</span>}
                    </td>
                    <td className="nt-td" onClick={e=>e.stopPropagation()}>
                      <div className="nt-status-wrap">
                        <button className="nt-status-badge" style={{color:st.color, background:st.bg, borderColor:`${st.color}44`}}
                          onClick={() => setOpenStatusId(openStatusId===job.id ? null : job.id)}>
                          {st.label} ▾
                        </button>
                        {openStatusId === job.id && (
                          <div className="nt-status-dropdown">
                            {STATUSES.map(s => (
                              <button key={s.id} className="nt-status-opt" style={{color:s.color}}
                                onClick={() => { updateField(job.id,"status",s.id); setOpenStatusId(null); }}>
                                <span className="nt-status-dot" style={{background:s.color}}/>{s.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="nt-td"><span className="nt-dim">{job.date}</span></td>
                    <td className="nt-td">
                      {isEdit
                        ? <input className="nt-inline-input" placeholder="Add notes…" value={job.notes||""} onClick={e=>e.stopPropagation()} onChange={e=>updateField(job.id,"notes",e.target.value)} />
                        : <span className="nt-dim nt-truncate">{job.notes || ""}</span>}
                    </td>
                    <td className="nt-td">
                      {job.url
                        ? <a href={job.url} target="_blank" rel="noopener noreferrer" className="nt-link" onClick={e=>e.stopPropagation()}>↗ Open</a>
                        : isEdit
                          ? <input className="nt-inline-input" placeholder="https://…" value={job.url||""} onClick={e=>e.stopPropagation()} onChange={e=>updateField(job.id,"url",e.target.value)} />
                          : null}
                    </td>
                    <td className="nt-td nt-actions" onClick={e=>e.stopPropagation()}>
                      <button className="nt-del-btn" onClick={() => deleteJob(job.id)} title="Delete">🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button className="nt-add-row" onClick={() => setShowModal(true)}>+ New row</button>
        </div>

      </div>

      {/* Add modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">New Application</div>
            {[
              { label: "Company *", key: "company", placeholder: "e.g. Google" },
              { label: "Position *", key: "title", placeholder: "e.g. Software Engineer" },
              { label: "Job URL", key: "url", placeholder: "https://..." },
              { label: "Notes", key: "notes", placeholder: "Recruiter name, referral, etc." },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="modal-field">
                <label className="modal-label">{label}</label>
                <input className="modal-input" placeholder={placeholder} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="modal-field">
              <label className="modal-label">Status</label>
              <div className="nt-status-picker">
                {STATUSES.map(s => (
                  <button key={s.id} className={`nt-pick-btn ${form.status===s.id?"selected":""}`}
                    style={form.status===s.id ? {color:s.color,background:s.bg,borderColor:`${s.color}55`} : {}}
                    onClick={() => setForm(f=>({...f,status:s.id}))}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="modal-save" onClick={addJob}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI TOOLS PAGE ─────────────────────────────────────────────────────────────
function ToolsPage() {
  const [activeTool, setActiveTool] = useState("linkedin");
  const tools = [
    { id: "linkedin", icon: "🔗", label: "LinkedIn", desc: "Optimize your profile" },
    { id: "email",    icon: "📧", label: "Cold Email", desc: "Write outreach emails" },
    { id: "skillgap", icon: "📊", label: "Skill Gap", desc: "Find what's missing" },
    { id: "salary",   icon: "💰", label: "Salary", desc: "Estimate your worth" },
  ];

  return (
    <div className="tools-page">
      <div className="page-banner">
        <h2>⚡ AI Tools</h2>
        <p>LinkedIn optimizer, cold email generator, skill gap analysis & salary estimator</p>
      </div>
      <div className="tools-layout">
        {/* Sidebar */}
        <div className="tools-sidebar">
          {tools.map(t => (
            <button key={t.id} className={`tool-nav-btn ${activeTool === t.id ? "active" : ""}`} onClick={() => setActiveTool(t.id)}>
              <span className="tool-nav-icon">{t.icon}</span>
              <div>
                <div className="tool-nav-label">{t.label}</div>
                <div className="tool-nav-desc">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
        {/* Main content */}
        <div className="tools-main">
          {activeTool === "linkedin"  && <LinkedInTool />}
          {activeTool === "email"     && <ColdEmailTool />}
          {activeTool === "skillgap"  && <SkillGapTool />}
          {activeTool === "salary"    && <SalaryTool />}
        </div>
      </div>
    </div>
  );
}

function LinkedInTool() {
  const [summary, setSummary]   = useState("");
  const [role, setRole]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const [copied, setCopied]     = useState(false);

  const run = async () => {
    if (summary.trim().length < 50) return setError("Please paste your LinkedIn summary (at least 50 chars).");
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${API}/optimize-linkedin/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedin_summary: summary, target_role: role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      setResult(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const scoreColor = result ? (result.score >= 70 ? "#30d158" : result.score >= 45 ? "#ffd60a" : "#ff453a") : "#fff";

  return (
    <div className="tool-card">
      <div className="tool-card-title">🔗 LinkedIn Profile Optimizer</div>
      <div className="tool-card-sub">Paste your current About section to get a score, rewrite, and recruiter keywords</div>
      <label className="field-label">LinkedIn About / Summary *</label>
      <textarea className="interview-textarea" rows={6} placeholder="Paste your current LinkedIn summary…" value={summary} onChange={e => setSummary(e.target.value)} />
      <label className="field-label">Target Role (optional)</label>
      <input className="modal-input" style={{ marginTop: 8 }} placeholder="e.g. Senior Product Manager" value={role} onChange={e => setRole(e.target.value)} />
      {error && <p className="error-msg" style={{ marginTop: 10 }}>{error}</p>}
      <button className="analyze-btn" onClick={run} disabled={loading} style={{ marginTop: 20 }}>
        {loading ? <><span className="spinner" /> Analyzing…</> : "🔍 Optimize Profile"}
      </button>

      {result && (
        <div className="tool-result">
          <div className="linkedin-score-ring">
            <div className="linkedin-score-num" style={{ color: scoreColor }}>{result.score}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Profile Strength</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>out of 100</div>
            </div>
          </div>
          <div className="tool-result-title">Rewritten Summary</div>
          <div className="email-box" style={{ marginBottom: 16 }}>
            <button className="tool-copy-btn" onClick={() => { navigator.clipboard.writeText(result.rewritten); setCopied(true); setTimeout(()=>setCopied(false),2000); }}>{copied?"✓":"Copy"}</button>
            {result.rewritten}
          </div>
          {result.issues?.length > 0 && (<><div className="tool-result-title">Issues Found</div><div className="tag-list" style={{marginBottom:14}}>{result.issues.map((s,i)=><span key={i} className="tag-pill tag-red">⚠ {s}</span>)}</div></>)}
          {result.keywords_to_add?.length > 0 && (<><div className="tool-result-title">Keywords to Add</div><div className="tag-list" style={{marginBottom:14}}>{result.keywords_to_add.map((k,i)=><span key={i} className="tag-pill tag-purple">{k}</span>)}</div></>)}
          {result.tips?.length > 0 && (<><div className="tool-result-title">Profile Tips</div><div className="skill-list">{result.tips.map((t,i)=><div key={i} className="skill-item"><span className="skill-dot" style={{background:"#bb86fc"}} />{t}</div>)}</div></>)}
        </div>
      )}
    </div>
  );
}

function ColdEmailTool() {
  const [form, setForm] = useState({ job_title: "", company: "", your_name: "", resume_text: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

  const run = async () => {
    if (!form.job_title || !form.company) return setError("Job title and company are required.");
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${API}/generate-cold-email/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      setResult(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="tool-card">
      <div className="tool-card-title">📧 Cold Email Generator</div>
      <div className="tool-card-sub">Write a recruiter outreach email that gets replies, plus a 5-day follow-up plan</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "Job Title *", key: "job_title", placeholder: "e.g. Software Engineer" },
          { label: "Company *",   key: "company",   placeholder: "e.g. Stripe" },
          { label: "Your Name",   key: "your_name", placeholder: "e.g. Bargavi Sivaraman" },
        ].map(({ label, key, placeholder }) => (
          <div key={key} style={{ gridColumn: key === "your_name" ? "1/-1" : undefined }}>
            <label className="field-label">{label}</label>
            <input className="modal-input" style={{ marginTop: 6 }} placeholder={placeholder} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
          </div>
        ))}
      </div>
      <label className="field-label" style={{ marginTop: 16 }}>Resume Snippet (optional, for personalization)</label>
      <textarea className="interview-textarea" rows={4} placeholder="Paste a few bullet points from your resume…" value={form.resume_text} onChange={e => setForm(f => ({ ...f, resume_text: e.target.value }))} />
      {error && <p className="error-msg" style={{ marginTop: 10 }}>{error}</p>}
      <button className="analyze-btn" onClick={run} disabled={loading} style={{ marginTop: 20 }}>
        {loading ? <><span className="spinner" /> Generating…</> : "✉ Write Cold Email"}
      </button>

      {result && (
        <div className="tool-result">
          <div className="tool-result-title">Outreach Email</div>
          <div className="email-box" style={{ marginBottom: 14 }}>
            <button className="tool-copy-btn" onClick={() => navigator.clipboard.writeText(`Subject: ${result.subject}\n\n${result.email}`)}>Copy</button>
            <div className="email-subject">Subject: {result.subject}</div>
            {result.email}
          </div>
          {result.follow_up && (
            <>
              <div className="tool-result-title">5-Day Follow-Up</div>
              <div className="email-box">
                <button className="tool-copy-btn" onClick={() => navigator.clipboard.writeText(result.follow_up)}>Copy</button>
                {result.follow_up}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SkillGapTool() {
  const [resumeText, setResumeText] = useState("");
  const [role, setRole]             = useState("");
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);

  const run = async () => {
    if (resumeText.trim().length < 100) return setError("Please paste more of your resume.");
    if (!role.trim()) return setError("Please enter a target role.");
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${API}/analyze-skill-gap/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text: resumeText, target_role: role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      setResult(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const readinessColor = result ? (result.readiness_score >= 70 ? "#30d158" : result.readiness_score >= 45 ? "#ffd60a" : "#ff453a") : "#fff";

  return (
    <div className="tool-card">
      <div className="tool-card-title">📊 Skill Gap Analyzer</div>
      <div className="tool-card-sub">See what skills you need for your target role and get a step-by-step learning roadmap</div>
      <label className="field-label">Target Role *</label>
      <input className="modal-input" style={{ marginTop: 6, marginBottom: 14 }} placeholder="e.g. Senior Data Scientist at FAANG" value={role} onChange={e => setRole(e.target.value)} />
      <label className="field-label">Your Resume *</label>
      <textarea className="interview-textarea" rows={6} placeholder="Paste your resume text…" value={resumeText} onChange={e => setResumeText(e.target.value)} />
      {error && <p className="error-msg" style={{ marginTop: 10 }}>{error}</p>}
      <button className="analyze-btn" onClick={run} disabled={loading} style={{ marginTop: 20 }}>
        {loading ? <><span className="spinner" /> Analyzing…</> : "📊 Analyze Skill Gap"}
      </button>

      {result && (
        <div className="tool-result">
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 52, fontWeight: 800, color: readinessColor, lineHeight: 1 }}>{result.readiness_score}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{result.readiness_label}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Readiness for {role}</div>
              <div className="readiness-bar-wrap" style={{ width: 160, marginTop: 8 }}>
                <div className="readiness-bar" style={{ width: `${result.readiness_score}%`, background: readinessColor }} />
              </div>
            </div>
          </div>
          {result.has_skills?.length > 0 && (<><div className="tool-result-title">Skills You Already Have ✓</div><div className="tag-list" style={{marginBottom:16}}>{result.has_skills.map((s,i)=><span key={i} className="tag-pill tag-green">{s}</span>)}</div></>)}
          {result.missing_critical?.length > 0 && (<><div className="tool-result-title">Critical Gaps 🚨</div><div className="tag-list" style={{marginBottom:16}}>{result.missing_critical.map((s,i)=><span key={i} className="tag-pill tag-red">{s}</span>)}</div></>)}
          {result.missing_nice?.length > 0 && (<><div className="tool-result-title">Nice to Have</div><div className="tag-list" style={{marginBottom:16}}>{result.missing_nice.map((s,i)=><span key={i} className="tag-pill tag-blue">{s}</span>)}</div></>)}
          {result.learning_path?.length > 0 && (
            <>
              <div className="tool-result-title">Learning Path</div>
              <div className="skill-list" style={{marginBottom:14}}>
                {result.learning_path.map((item,i) => (
                  <div key={i} className="skill-item">
                    <span className="skill-dot" style={{background:"#bb86fc"}} />
                    <div><strong style={{color:"var(--text)"}}>{item.skill}</strong> · {item.time}<br/><span style={{fontSize:12}}>{item.resource}</span></div>
                  </div>
                ))}
              </div>
            </>
          )}
          {result.quick_wins?.length > 0 && (<><div className="tool-result-title">Quick Wins ⚡</div><div className="skill-list">{result.quick_wins.map((q,i)=><div key={i} className="skill-item"><span className="skill-dot" style={{background:"#ffd60a"}} />{q}</div>)}</div></>)}
        </div>
      )}
    </div>
  );
}

function SalaryTool() {
  const [resumeText, setResumeText] = useState("");
  const [role, setRole]             = useState("");
  const [location, setLocation]     = useState("United States");
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);

  const run = async () => {
    if (resumeText.trim().length < 100) return setError("Please paste more of your resume.");
    if (!role.trim()) return setError("Please enter a target role.");
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${API}/estimate-salary/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text: resumeText, target_role: role, location }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      setResult(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const fmt = (n) => n ? `$${(n/1000).toFixed(0)}k` : "—";

  return (
    <div className="tool-card">
      <div className="tool-card-title">💰 Salary Estimator</div>
      <div className="tool-card-sub">Know your market value before every negotiation. Get min, median, and max salary ranges.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <label className="field-label">Target Role *</label>
          <input className="modal-input" style={{ marginTop: 6 }} placeholder="e.g. Senior Backend Engineer" value={role} onChange={e => setRole(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Location</label>
          <input className="modal-input" style={{ marginTop: 6 }} placeholder="e.g. San Francisco, CA" value={location} onChange={e => setLocation(e.target.value)} />
        </div>
      </div>
      <label className="field-label">Your Resume *</label>
      <textarea className="interview-textarea" rows={6} placeholder="Paste your resume text…" value={resumeText} onChange={e => setResumeText(e.target.value)} />
      {error && <p className="error-msg" style={{ marginTop: 10 }}>{error}</p>}
      <button className="analyze-btn" onClick={run} disabled={loading} style={{ marginTop: 20 }}>
        {loading ? <><span className="spinner" /> Estimating…</> : "💰 Estimate Salary"}
      </button>

      {result && (
        <div className="tool-result">
          <div style={{ marginBottom: 8 }}>
            <span className="tag-pill tag-purple" style={{ fontSize: 13 }}>{result.experience_level}</span>
            {result.years_experience && <span style={{ fontSize: 13, color: "var(--text-dim)", marginLeft: 10 }}>~{result.years_experience} years exp</span>}
          </div>
          {result.salary_range && (
            <div className="salary-range">
              <div className="salary-card"><div className="salary-label">Min</div><div className="salary-value">{fmt(result.salary_range.min)}</div></div>
              <div className="salary-card" style={{ border: "1px solid rgba(123,47,247,0.4)" }}><div className="salary-label">Median</div><div className="salary-value" style={{ color: "#bb86fc" }}>{fmt(result.salary_range.median)}</div></div>
              <div className="salary-card"><div className="salary-label">Max</div><div className="salary-value">{fmt(result.salary_range.max)}</div></div>
            </div>
          )}
          {result.equity_range && <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>📈 Equity: {result.equity_range}</div>}
          {result.factors_positive?.length > 0 && (<><div className="tool-result-title">What Commands Higher Pay ✓</div><div className="skill-list" style={{marginBottom:14}}>{result.factors_positive.map((f,i)=><div key={i} className="skill-item"><span className="skill-dot" style={{background:"#30d158"}} />{f}</div>)}</div></>)}
          {result.factors_negative?.length > 0 && (<><div className="tool-result-title">Gaps That May Lower Offers</div><div className="skill-list" style={{marginBottom:14}}>{result.factors_negative.map((f,i)=><div key={i} className="skill-item"><span className="skill-dot" style={{background:"#ff453a"}} />{f}</div>)}</div></>)}
          {result.negotiation_tips?.length > 0 && (<><div className="tool-result-title">Negotiation Tips 💡</div><div className="skill-list" style={{marginBottom:14}}>{result.negotiation_tips.map((t,i)=><div key={i} className="skill-item"><span className="skill-dot" style={{background:"#ffd60a"}} />{t}</div>)}</div></>)}
          {result.comparable_roles?.length > 0 && (<><div className="tool-result-title">Similar Roles to Target</div><div className="tag-list">{result.comparable_roles.map((r,i)=><span key={i} className="tag-pill tag-blue">{r}</span>)}</div></>)}
        </div>
      )}
    </div>
  );
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
const TAB_ORDER = ["resume","cover","jobs","interview","tracker","tools"];

function App() {
  const [tab, setTab]               = useState("resume");
  const [transDir, setTransDir]     = useState("forward");
  const tabRef                      = useRef("resume");
  const [interviewTitle, setInterviewTitle]   = useState(null);
  const [interviewCompany, setInterviewCompany] = useState(null);
  const [theme, setThemeState]      = useState(() => localStorage.getItem("ltr_theme") || "dark");

  const switchTab = useCallback((newTab) => {
    const oldIdx = TAB_ORDER.indexOf(tabRef.current);
    const newIdx = TAB_ORDER.indexOf(newTab);
    setTransDir(newIdx >= oldIdx ? "forward" : "backward");
    tabRef.current = newTab;
    setTab(newTab);
  }, []);

  const setTheme = (t) => {
    setThemeState(t);
    localStorage.setItem("ltr_theme", t);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handlePrepInterview = (title, company) => {
    setInterviewTitle(title);
    setInterviewCompany(company);
    switchTab("interview");
  };

  const resetApp = () => {
    setInterviewTitle(null);
    setInterviewCompany(null);
  };

  return (
    <>
      <FloatingOrbs />
      <Nav tab={tab} setTab={switchTab} resetApp={resetApp} theme={theme} setTheme={setTheme} />
      <main className="main-content">
        <div className="tab-panel" key={tab} data-dir={transDir}>
          {tab === "resume"    && <ResumePage />}
          {tab === "cover"     && <CoverLetterPage />}
          {tab === "jobs"      && <JobsTab onPrepInterview={handlePrepInterview} />}
          {tab === "interview" && <InterviewPage prefillTitle={interviewTitle} prefillCompany={interviewCompany} />}
          {tab === "tracker"   && <TrackerPage />}
          {tab === "tools"     && <ToolsPage />}
        </div>
      </main>
      <Footer />
      <ChatBot />
    </>
  );
}

export default App;

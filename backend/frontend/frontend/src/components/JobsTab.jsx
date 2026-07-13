import { useState, useEffect, useRef, useCallback } from "react";
import useSavedJobs from "../hooks/useSavedJobs";
import JobsStatusBar from "./JobsStatusBar";
import CompanyAvatar from "./CompanyAvatar";
import SkeletonJobCard from "./SkeletonJobCard";
import { filterJobsForRole, filterJobsForMajor, scoreJobForRole, RELEVANCE_THRESHOLD } from "../lib/roleMatcher";
import { roundedCount, isJobNew } from "../lib/format";
import { expandSearchQuery } from "../lib/search";
import { getSource, formatEmploymentType } from "../lib/jobMeta";
import { getResumeKeywords, matchScore } from "../lib/resumeMatch";
import {
  SECTORS,
  SECTORS_BY_CATEGORY,
  SECTOR_CATEGORIES,
  SECTOR_BY_ID,
  TRENDING_SECTORS,
} from "../data/sectors";
import {
  MAJORS,
  MAJORS_BY_CATEGORY,
  MAJOR_CATEGORIES,
  MAJOR_BY_ID,
  TOP_MAJORS,
  TOTAL_ROLE_COUNT,
} from "../data/majors";
import { POPULAR_LOCATIONS } from "../data/locations";

const API = "https://landtherole-ai.onrender.com";

// ── industry colors (kept compatible with backend's 15 industries) ───────────
const INDUSTRY_COLORS = {
  "Technology":          "#7c3aff",
  "Healthcare":          "#22e597",
  "Education":           "#ff9f0a",
  "Finance":             "#60a5fa",
  "Legal":               "#ffce47",
  "Marketing":           "#ff5d8f",
  "Sales":               "#ff7a59",
  "Design & Creative":   "#d946ef",
  "Human Resources":     "#a78bfa",
  "Supply Chain":        "#fbbf24",
  "Engineering":         "#9ca3af",
  "Government":          "#64d2ff",
  "Research & Science":  "#34d399",
  "Retail & Hospitality":"#fb7185",
  "Business":            "#c084fc",
  "Other":               "#94a3b8",
};

const EXP_COLORS = {
  "Entry Level": "#22e597",
  "Mid Level":   "#60a5fa",
  "Senior":      "#ff9f0a",
  "Executive":   "#ffce47",
};

const CACHE_KEY = "nexume_jobs_cache_v2";
const CACHE_TTL = 5 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Sector Picker — sticky search filter that opens a categorized popover
// ─────────────────────────────────────────────────────────────────────────────
function SectorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const popRef = useRef(null);
  const selected = value ? SECTOR_BY_ID[value] : null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (popRef.current && !popRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = query
    ? SECTORS.filter(s => s.label.toLowerCase().includes(query.toLowerCase()) || s.keywords.some(k => k.includes(query.toLowerCase())))
    : null;

  return (
    <div className="sector-picker-wrap" ref={popRef}>
      <button
        className={`sector-picker-trigger ${open ? "open" : ""} ${selected ? "has-value" : ""}`}
        onClick={() => setOpen(v => !v)}
      >
        {selected ? (
          <>
            <span className="sector-picker-emoji">{selected.emoji}</span>
            <span className="sector-picker-label">{selected.label}</span>
            <span className="sector-picker-clear" onClick={(e) => { e.stopPropagation(); onChange(null); }}>×</span>
          </>
        ) : (
          <>
            <span className="sector-picker-emoji">🎯</span>
            <span className="sector-picker-label">Pick a sector</span>
            <span className="sector-picker-count">{SECTORS.length}+</span>
            <span className="sector-picker-chev">▾</span>
          </>
        )}
      </button>

      {open && (
        <div className="sector-popover">
          <input
            className="sector-popover-search"
            placeholder="Search 100+ sectors…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <div className="sector-popover-body">
            {filtered ? (
              <div className="sector-popover-group">
                <div className="sector-popover-group-label">{filtered.length} match{filtered.length !== 1 ? "es" : ""}</div>
                <div className="sector-popover-grid">
                  {filtered.map(s => (
                    <button
                      key={s.id}
                      className={`sector-option ${value === s.id ? "active" : ""}`}
                      onClick={() => { onChange(s.id); setOpen(false); setQuery(""); }}
                    >
                      <span className="sector-emoji">{s.emoji}</span>
                      <span className="sector-name">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              SECTOR_CATEGORIES.map(cat => (
                <div key={cat.id} className="sector-popover-group">
                  <div className="sector-popover-group-label">{cat.emoji} {cat.label}</div>
                  <div className="sector-popover-grid">
                    {SECTORS_BY_CATEGORY[cat.id]?.map(s => (
                      <button
                        key={s.id}
                        className={`sector-option ${value === s.id ? "active" : ""}`}
                        onClick={() => { onChange(s.id); setOpen(false); }}
                      >
                        <span className="sector-emoji">{s.emoji}</span>
                        <span className="sector-name">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Major Picker — opens categorized popover with 50+ majors and 2000+ role tags
// ─────────────────────────────────────────────────────────────────────────────
function MajorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const popRef = useRef(null);
  const selected = value ? MAJOR_BY_ID[value] : null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (popRef.current && !popRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = query
    ? MAJORS.filter(m =>
        m.label.toLowerCase().includes(query.toLowerCase()) ||
        m.roles.some(r => r.label.toLowerCase().includes(query.toLowerCase()))
      )
    : null;

  return (
    <div className="sector-picker-wrap major-picker-wrap" ref={popRef}>
      <button
        className={`sector-picker-trigger ${open ? "open" : ""} ${selected ? "has-value" : ""}`}
        onClick={() => setOpen(v => !v)}
      >
        {selected ? (
          <>
            <span className="sector-picker-emoji">{selected.emoji}</span>
            <span className="sector-picker-label">{selected.label}</span>
            <span className="sector-picker-clear" onClick={(e) => { e.stopPropagation(); onChange(null); }}>×</span>
          </>
        ) : (
          <>
            <span className="sector-picker-emoji">🎓</span>
            <span className="sector-picker-label">Pick your major</span>
            <span className="sector-picker-count">{roundedCount(MAJORS.length)} majors · {roundedCount(TOTAL_ROLE_COUNT)} roles</span>
            <span className="sector-picker-chev">▾</span>
          </>
        )}
      </button>

      {open && (
        <div className="sector-popover major-popover">
          <input
            className="sector-popover-search"
            placeholder={`Search ${roundedCount(MAJORS.length)} majors or ${roundedCount(TOTAL_ROLE_COUNT)} roles…`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <div className="sector-popover-body">
            {filtered ? (
              <div className="sector-popover-group">
                <div className="sector-popover-group-label">{filtered.length} match{filtered.length !== 1 ? "es" : ""}</div>
                <div className="sector-popover-grid major-popover-grid">
                  {filtered.map(m => (
                    <button
                      key={m.id}
                      className={`sector-option major-option ${value === m.id ? "active" : ""} ${m.isTop ? "is-top" : ""}`}
                      onClick={() => { onChange(m.id); setOpen(false); setQuery(""); }}
                    >
                      <span className="sector-emoji">{m.emoji}</span>
                      <span className="sector-name">
                        {m.label}
                        <span className="major-option-roles">{roundedCount(m.roles.length)} roles</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              MAJOR_CATEGORIES.map(cat => (
                <div key={cat.id} className="sector-popover-group">
                  <div className="sector-popover-group-label">{cat.emoji} {cat.label}</div>
                  <div className="sector-popover-grid major-popover-grid">
                    {MAJORS_BY_CATEGORY[cat.id]?.map(m => (
                      <button
                        key={m.id}
                        className={`sector-option major-option ${value === m.id ? "active" : ""} ${m.isTop ? "is-top" : ""}`}
                        onClick={() => { onChange(m.id); setOpen(false); }}
                      >
                        <span className="sector-emoji">{m.emoji}</span>
                        <span className="sector-name">
                          {m.label}
                          <span className="major-option-roles">{roundedCount(m.roles.length)} roles</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Roles Strip — horizontal scrollable chips for roles of the selected major
// ─────────────────────────────────────────────────────────────────────────────
function RolesStrip({ majorId, activeRoleId, onPickRole }) {
  if (!majorId) return null;
  const major = MAJOR_BY_ID[majorId];
  if (!major) return null;
  return (
    <div className="jobs-roles-strip">
      <div className="jobs-roles-strip-header">
        <span className="jobs-roles-strip-label">
          <span className="jobs-roles-strip-emoji">{major.emoji}</span>
          <strong>{major.label}</strong>
          <span className="jobs-roles-strip-count">{roundedCount(major.roles.length)} roles</span>
        </span>
      </div>
      <div className="jobs-roles-strip-pills">
        {major.roles.map(role => (
          <button
            key={role.id}
            className={`jobs-role-pill ${activeRoleId === role.id ? "active" : ""}`}
            onClick={() => onPickRole(activeRoleId === role.id ? null : role.id)}
          >
            {role.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Popular Locations — chip group for quick location-filter
// ─────────────────────────────────────────────────────────────────────────────
function PopularLocations({ activeValue, onPick }) {
  return (
    <div className="jobs-filter-section">
      <span className="jobs-filter-label">Popular USA locations</span>
      <div className="jobs-popular-locations">
        {POPULAR_LOCATIONS.map(loc => (
          <button
            key={loc.id}
            className={`jobs-location-pill ${activeValue === loc.value ? "active" : ""} ${loc.remote ? "is-remote" : ""}`}
            onClick={() => onPick(loc)}
          >
            <span className="jobs-location-pill-emoji">{loc.emoji}</span>
            <span>{loc.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Salary Range Slider — dual handle
// ─────────────────────────────────────────────────────────────────────────────
function SalaryRange({ value, onChange }) {
  const [min, max] = value;
  return (
    <div className="salary-range-control">
      <div className="salary-range-header">
        <span>Salary</span>
        <span className="salary-range-value">
          ${(min/1000).toFixed(0)}k <span style={{ opacity: 0.4 }}>–</span> {max >= 400000 ? "400k+" : `$${(max/1000).toFixed(0)}k`}
        </span>
      </div>
      <div className="salary-range-track">
        <input
          type="range" min={0} max={400000} step={5000}
          value={min}
          onChange={e => onChange([Math.min(+e.target.value, max - 5000), max])}
          className="salary-range-slider min"
        />
        <input
          type="range" min={0} max={400000} step={5000}
          value={max}
          onChange={e => onChange([min, Math.max(+e.target.value, min + 5000)])}
          className="salary-range-slider max"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Trending sectors strip
// ─────────────────────────────────────────────────────────────────────────────
function TrendingStrip({ onPick, active }) {
  return (
    <div className="jobs-trending-strip">
      <span className="jobs-trending-label">
        <span className="jobs-trending-emoji">🔥</span> Trending now
      </span>
      <div className="jobs-trending-pills">
        {TRENDING_SECTORS.map(id => {
          const s = SECTOR_BY_ID[id];
          if (!s) return null;
          return (
            <button
              key={id}
              className={`jobs-trending-pill ${active === id ? "active" : ""}`}
              onClick={() => onPick(active === id ? null : id)}
            >
              <span className="jobs-trending-pill-emoji">{s.emoji}</span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Jobs Tab
// ─────────────────────────────────────────────────────────────────────────────
export default function JobsTab({ onPrepInterview }) {
  const [country, setCountry]             = useState("US");
  const [query, setQuery]                 = useState("");
  const [locationQuery, setLocationQuery] = useState("Los Angeles, CA");
  const [activeSector, setActiveSector]   = useState(null);   // sector id
  const [activeMajor, setActiveMajor]     = useState(null);   // major id
  const [activeRole, setActiveRole]       = useState(null);   // role id within selected major
  const [jobs, setJobs]                   = useState([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [backupMode, setBackupMode]       = useState(false); // supabase offline → live-API fallback feed
  const [retryMsg, setRetryMsg]           = useState(null);
  const [page, setPage]                   = useState(1);
  const [hasMore, setHasMore]             = useState(false);
  const [expanded, setExpanded]           = useState(null);
  const [viewMode, setViewMode]           = useState("all"); // "all" | "saved"
  const [filters, setFilters] = useState({
    jobType: "", expLevel: "", dateRange: "all", remote: false, stateFilter: "",
    internship: false, newGrad: false,
  });
  const [salary, setSalary] = useState([0, 400000]);
  const abortRef = useRef(null);
  const { saved, isSaved, toggleSave } = useSavedJobs();
  const resumeKeywords = useRef(getResumeKeywords());
  useEffect(() => { resumeKeywords.current = getResumeKeywords(); }, []);

  // ── load cache ───────────────────────────────────────────────────────────
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

  const sectorIndustry = activeSector ? SECTOR_BY_ID[activeSector]?.dbIndustry : "";

  const fetchJobs = useCallback(async (c, kw, pg, f = filters, sectorId = activeSector, majorId = activeMajor, roleId = activeRole) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (pg === 1) setJobs([]);
    setLoading(true);
    setError(null);
    setRetryMsg(null);
    try {
      // Resolve major + role context — role keyword > sector seed > major default > raw typed query
      const majorData  = majorId ? MAJOR_BY_ID[majorId] : null;
      const roleData   = roleId && majorData ? majorData.roles.find(r => r.id === roleId) : null;
      const sectorData = sectorId ? SECTOR_BY_ID[sectorId] : null;

      // Keyword priority: typed query > picked role > sector keyword > nothing.
      // Run the typed query through search expansion so SWE → "software engineer",
      // "software enginner" → "software engineer", "front-end" → "frontend", etc.
      const rawKw = kw.trim();
      const expandedTyped = rawKw ? expandSearchQuery(rawKw) : "";
      const expandedKeyword = expandedTyped
        || (roleData ? roleData.label : "")
        || (sectorData ? sectorData.keywords[0] : "");

      // Industry priority: major > sector
      const industry = (majorData && majorData.dbIndustry) || (sectorData ? sectorData.dbIndustry : "");

      const params = new URLSearchParams({ country: c, page: pg, per_page: 20 });
      if (expandedKeyword)       params.set("keyword", expandedKeyword);
      if (locationQuery.trim())  {
        // Send under BOTH params — `location` is used by the live-API fallback path,
        // `state_filter` is used by the cached-jobs Supabase query. Backend OR-matches
        // state_filter across city/state/location columns.
        params.set("location", locationQuery.trim());
        params.set("state_filter", locationQuery.trim());
      }
      if (industry)              params.set("industry", industry);
      if (f.jobType)             params.set("job_type", f.jobType);
      if (f.internship)          params.set("job_type", "Internship");
      if (f.newGrad)             params.set("experience_level", "Entry Level");
      else if (f.expLevel)       params.set("experience_level", f.expLevel);
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
      setBackupMode(data.supabase_offline === true);
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
  }, [filters, locationQuery, activeSector, activeMajor, activeRole]);

  useEffect(() => { fetchJobs(country, query, 1); /* eslint-disable-next-line */ }, [country]);

  useEffect(() => {
    if (!query) return;
    const t = setTimeout(() => fetchJobs(country, query, 1), 400);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
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

  const pickSector = (sectorId) => {
    setActiveSector(sectorId);
    setExpanded(null);
    fetchJobs(country, query, 1, filters, sectorId, activeMajor, activeRole);
  };

  const pickMajor = (majorId) => {
    setActiveMajor(majorId);
    setActiveRole(null);
    setExpanded(null);
    fetchJobs(country, query, 1, filters, activeSector, majorId, null);
  };

  const pickRole = (roleId) => {
    setActiveRole(roleId);
    setExpanded(null);
    fetchJobs(country, query, 1, filters, activeSector, activeMajor, roleId);
  };

  const pickLocation = (loc) => {
    const value = loc.value;
    const newFilters = { ...filters, remote: !!loc.remote };
    setFilters(newFilters);
    setLocationQuery(loc.remote ? "" : value);
    fetchJobs(country, query, 1, newFilters, activeSector, activeMajor, activeRole);
  };

  const clearFilters = () => {
    const reset = { jobType: "", expLevel: "", dateRange: "all", remote: false, stateFilter: "", internship: false, newGrad: false };
    setFilters(reset);
    setActiveSector(null);
    setActiveMajor(null);
    setActiveRole(null);
    setSalary([0, 400000]);
    setLocationQuery("");
    fetchJobs(country, query, 1, reset, null, null, null);
  };

  const hasActiveFilters = activeSector || activeMajor || activeRole ||
                           filters.jobType || filters.expLevel ||
                           filters.dateRange !== "all" || filters.remote || filters.stateFilter ||
                           filters.internship || filters.newGrad ||
                           salary[0] > 0 || salary[1] < 400000;

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 3600000);
    if (diff < 1)  return "Just now";
    if (diff < 24) return `${diff}h ago`;
    const d = Math.floor(diff / 24);
    if (d < 7)     return `${d}d ago`;
    return `${Math.floor(d / 7)}w ago`;
  };

  // Resolve picked role for strict matching
  const activeMajorData = activeMajor ? MAJOR_BY_ID[activeMajor] : null;
  const activeRoleData = activeRoleId => activeRoleId && activeMajorData
    ? activeMajorData.roles.find(r => r.id === activeRoleId)
    : null;
  const pickedRole = activeRoleData(activeRole);

  // Step 1: salary filter
  const salaryFiltered = (viewMode === "saved" ? saved : jobs).filter(j => {
    if (salary[0] === 0 && salary[1] >= 400000) return true;
    const jmin = j.salary_min;
    const jmax = j.salary_max;
    if (jmin == null && jmax == null) return true;
    const lo = jmin ?? jmax;
    const hi = jmax ?? jmin;
    return hi >= salary[0] && lo <= salary[1];
  });

  // Step 2: STRICT role-matcher filter when a specific role is picked.
  // Step 2b: When only a major is picked (no specific role), apply major-level
  //   matcher so Physics doesn't return music-research jobs.
  const roleFiltered = pickedRole
    ? filterJobsForRole(salaryFiltered, pickedRole, activeMajorData)
    : activeMajorData
      ? filterJobsForMajor(salaryFiltered, activeMajorData)
      : salaryFiltered;

  // Step 3: client-side date filter using posted_at. Backend also filters, but
  // this guarantees correctness — "Past 24h" only shows jobs the source posted
  // within the last 24h, never jobs we just freshly ingested.
  const visibleJobs = (() => {
    if (filters.dateRange === "all") return roleFiltered;
    const maxHours = { "24h": 24, "7d": 168, "30d": 720 }[filters.dateRange];
    if (!maxHours) return roleFiltered;
    const cutoff = Date.now() - maxHours * 3600_000;
    return roleFiltered.filter((j) => {
      if (!j.posted_at) return false; // unknown posting date → excluded
      const t = new Date(j.posted_at).getTime();
      return !isNaN(t) && t >= cutoff;
    });
  })();

  const filteredOutCount = (pickedRole || activeMajorData)
    ? salaryFiltered.length - visibleJobs.length
    : 0;

  // NEW badge: use posted_at < 24h (the actual job posting age, not when we fetched it).
  // Returns false when the source did not expose a posted timestamp.
  const isFresh = (job) => isJobNew(job);

  return (
    <div className="jobs-page">
      {/* Sticky search header */}
      <div className="jobs-search-bar">
        <input
          className="jobs-search-input"
          placeholder="Search jobs, skills, or companies…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
        />
        <input
          className="jobs-location-input"
          placeholder="Location (e.g. SF, Remote)"
          value={locationQuery}
          onChange={e => setLocationQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
        />
        <MajorPicker value={activeMajor} onChange={pickMajor} />
        <button className="jobs-search-btn" onClick={search}>Search</button>
      </div>

      {/* Roles strip — appears when a major is selected */}
      <RolesStrip majorId={activeMajor} activeRoleId={activeRole} onPickRole={pickRole} />

      {/* Trending sectors strip */}
      <TrendingStrip onPick={pickSector} active={activeSector} />

      <div className="jobs-body">
        {/* Sidebar */}
        <aside className="jobs-sidebar">
          {/* View toggle */}
          <div className="jobs-view-toggle">
            <button
              className={`jobs-view-btn ${viewMode === "all" ? "active" : ""}`}
              onClick={() => setViewMode("all")}
            >
              All jobs
            </button>
            <button
              className={`jobs-view-btn ${viewMode === "saved" ? "active" : ""}`}
              onClick={() => setViewMode("saved")}
            >
              <span>♥</span> Saved <span className="jobs-view-count">{saved.length}</span>
            </button>
          </div>

          {/* Popular USA locations */}
          <PopularLocations activeValue={locationQuery} onPick={pickLocation} />

          <div className="jobs-sidebar-title">
            <span>Filters</span>
            {hasActiveFilters && <button className="jobs-sidebar-clear" onClick={clearFilters}>Clear all</button>}
          </div>

          {/* Career stage chips */}
          <div className="jobs-filter-section">
            <span className="jobs-filter-label">Career stage</span>
            <div className="jobs-filter-chips">
              <button
                className={`jobs-filter-chip ${filters.internship ? "active" : ""}`}
                onClick={() => applyFilter("internship", !filters.internship)}
              >🎓 Internship</button>
              <button
                className={`jobs-filter-chip ${filters.newGrad ? "active" : ""}`}
                onClick={() => applyFilter("newGrad", !filters.newGrad)}
              >✨ New Grad</button>
              {[["Entry Level","Entry"],["Mid Level","Mid"],["Senior","Senior"],["Executive","Exec"]].map(([val, label]) => (
                <button
                  key={val}
                  className={`jobs-filter-chip ${filters.expLevel === val ? "active" : ""}`}
                  onClick={() => applyFilter("expLevel", filters.expLevel === val ? "" : val)}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Job type */}
          <div className="jobs-filter-section">
            <span className="jobs-filter-label">Job type</span>
            <div className="jobs-filter-chips">
              {[["Full-time","Full-time"],["Part-time","Part-time"],["Contract","Contract"],["Internship","Internship"]].map(([val, label]) => (
                <button
                  key={val}
                  className={`jobs-filter-chip ${filters.jobType === val ? "active" : ""}`}
                  onClick={() => applyFilter("jobType", filters.jobType === val ? "" : val)}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Date posted */}
          <div className="jobs-filter-section">
            <span className="jobs-filter-label">Date posted</span>
            <div className="jobs-filter-chips">
              {[["all","Any"],["24h","Past 24h"],["7d","Past week"],["30d","Past month"]].map(([val, label]) => (
                <button
                  key={val}
                  className={`jobs-filter-chip ${filters.dateRange === val ? "active" : ""}`}
                  onClick={() => applyFilter("dateRange", val)}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Salary slider */}
          <div className="jobs-filter-section">
            <SalaryRange value={salary} onChange={setSalary} />
          </div>

          {/* Remote toggle */}
          <div className="jobs-filter-section">
            <span className="jobs-filter-label">Work mode</span>
            <div className="jobs-remote-row">
              <span className="jobs-remote-label">Remote only</span>
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

        {/* Main column */}
        <main className="jobs-main">
          {/* Live status bar — total jobs, last updated, source health */}
          <JobsStatusBar />

          {/* Mobile horizontal filter row */}
          <div className="jobs-mobile-filters">
            <button
              className={`jobs-filter-chip ${viewMode === "saved" ? "active" : ""}`}
              onClick={() => setViewMode(viewMode === "saved" ? "all" : "saved")}
            >♥ Saved {saved.length}</button>
            <button
              className={`jobs-filter-chip ${filters.internship ? "active" : ""}`}
              onClick={() => applyFilter("internship", !filters.internship)}
            >Internship</button>
            <button
              className={`jobs-filter-chip ${filters.newGrad ? "active" : ""}`}
              onClick={() => applyFilter("newGrad", !filters.newGrad)}
            >New Grad</button>
            {[["Full-time","Full-time"],["Part-time","Part-time"],["Contract","Contract"]].map(([val, label]) => (
              <button key={val} className={`jobs-filter-chip ${filters.jobType === val ? "active" : ""}`}
                onClick={() => applyFilter("jobType", filters.jobType === val ? "" : val)}>{label}</button>
            ))}
            <button
              className={`jobs-filter-chip ${filters.remote ? "active" : ""}`}
              onClick={() => applyFilter("remote", !filters.remote)}
            >Remote</button>
          </div>

          {retryMsg && (
            <div className="jobs-retry-banner">⏳ {retryMsg}</div>
          )}

          {error === "cold_start" ? (
            <div className="jobs-empty">
              <p style={{ fontSize: "16px", marginBottom: "8px" }}>⏳ Server is waking up…</p>
              <p style={{ opacity: 0.6, marginBottom: "20px" }}>This can take up to 60 seconds on first load.</p>
              <button className="load-more-btn" onClick={() => fetchJobs(country, query, 1)}>Retry</button>
            </div>
          ) : error ? (
            <div className="jobs-empty">
              <p style={{ fontSize: "15px", marginBottom: "16px", color: "var(--danger)" }}>⚠ {error}</p>
              <button className="load-more-btn" onClick={() => fetchJobs(country, query, 1)}>Retry</button>
            </div>
          ) : null}

          {!error && (
            loading && jobs.length === 0 && viewMode === "all" ? (
              <div>
                {Array.from({ length: 6 }).map((_, i) => <SkeletonJobCard key={i} />)}
              </div>
            ) : viewMode === "saved" && saved.length === 0 ? (
              <div className="jobs-empty">
                <p style={{ fontSize: "28px", marginBottom: "12px" }}>♥</p>
                <p style={{ fontSize: "15px", marginBottom: "6px" }}>No saved jobs yet</p>
                <p style={{ opacity: 0.5 }}>Tap the heart on any job to save it for later.</p>
              </div>
            ) : visibleJobs.length === 0 && !loading ? (
              <div className="jobs-empty">No jobs match your filters. Try widening your search.</div>
            ) : (
              <>
                {visibleJobs.length > 0 && (
                  <div className="jobs-result-bar">
                    <span className="jobs-result-count">
                      <strong>{visibleJobs.length}</strong> {viewMode === "saved" ? "saved" : "matching"} job{visibleJobs.length !== 1 ? "s" : ""}
                      {hasActiveFilters && viewMode === "all" ? " · filtered" : ""}
                      {pickedRole && filteredOutCount > 0 && (
                        <span className="jobs-result-filtered-out"> · {filteredOutCount} hidden as off-target</span>
                      )}
                    </span>
                    {backupMode && (
                      <span className="jobs-backup-note" title="Primary job database is being restored — showing jobs from live partner feeds instead">
                        ⚡ Live feed · backup mode
                      </span>
                    )}
                    {pickedRole && (
                      <span className="jobs-result-pill">
                        <span className="jobs-result-pill-dot" />
                        Strict role match · ≥{RELEVANCE_THRESHOLD}% relevance
                      </span>
                    )}
                    {resumeKeywords.current && viewMode === "all" && !pickedRole && (
                      <span className="jobs-result-pill">
                        <span className="jobs-result-pill-dot" /> AI matching active
                      </span>
                    )}
                  </div>
                )}
                {visibleJobs.map(job => {
                  const indColor = INDUSTRY_COLORS[job.industry] || "#94a3b8";
                  const expColor = EXP_COLORS[job.experience_level] || "#94a3b8";
                  const empType = formatEmploymentType(job.employment_type || job.job_type);
                  const timeAgo = job.posted_at ? formatDate(job.posted_at) : null;
                  const isExpanded = expanded === job.job_id;
                  const score = matchScore(job, resumeKeywords.current);
                  const savedNow = isSaved(job.job_id);
                  const salaryText =
                    job.salary_min && job.salary_max
                      ? `$${Math.round(job.salary_min/1000)}k–$${Math.round(job.salary_max/1000)}k`
                      : job.salary_min
                        ? `From $${Math.round(job.salary_min/1000)}k`
                        : job.salary_max
                          ? `Up to $${Math.round(job.salary_max/1000)}k`
                          : null;

                  return (
                    <div
                      key={job.job_id}
                      className={`li-job-card ${isExpanded ? "active" : ""}`}
                      onClick={() => setExpanded(isExpanded ? null : job.job_id)}
                    >
                      <button
                        className={`save-job-btn ${savedNow ? "saved" : ""}`}
                        onClick={(e) => { e.stopPropagation(); toggleSave(job); }}
                        title={savedNow ? "Unsave" : "Save"}
                        aria-label={savedNow ? "Unsave job" : "Save job"}
                      >
                        {savedNow ? "♥" : "♡"}
                      </button>

                      <div className="li-card-top">
                        <CompanyAvatar name={job.company} size={48} />
                        <div className="li-card-info">
                          <div className="li-job-title">{job.title || "Untitled"}</div>
                          <div className="li-job-company">{job.company || "Company not listed"}</div>
                          {job.location && <div className="li-job-location">{job.location}</div>}
                        </div>
                        <div className="li-card-side">
                          {pickedRole && job._relevance != null && (
                            <div className="match-badge relevance-badge" title={`Role relevance · ${job._relevance}/100`} style={{
                              color: job._relevance >= 80 ? "#22e597" : job._relevance >= 65 ? "#c084fc" : "#ffce47",
                              borderColor: job._relevance >= 80 ? "rgba(34,229,151,0.45)" : job._relevance >= 65 ? "rgba(192,132,252,0.45)" : "rgba(255,206,71,0.4)",
                            }}>
                              <span className="match-badge-num">{job._relevance}</span>
                              <span className="match-badge-label">role fit</span>
                            </div>
                          )}
                          {!pickedRole && score != null && (
                            <div className="match-badge" title="AI match against your resume" style={{
                              color: score >= 70 ? "#22e597" : score >= 40 ? "#ffce47" : "#94a3b8",
                              borderColor: score >= 70 ? "rgba(34,229,151,0.4)" : score >= 40 ? "rgba(255,206,71,0.4)" : "rgba(148,163,184,0.3)",
                            }}>
                              <span className="match-badge-num">{score}</span>
                              <span className="match-badge-label">match</span>
                            </div>
                          )}
                          {isFresh(job) && <span className="fresh-badge">NEW</span>}
                          {timeAgo && <span className="li-time">{timeAgo}</span>}
                        </div>
                      </div>

                      <div className="li-card-meta">
                        {job.industry && job.industry !== "Other" && (
                          <span className="li-badge" style={{ color: indColor, background: `${indColor}1f`, borderColor: `${indColor}55` }}>
                            {job.industry}
                          </span>
                        )}
                        {empType && (
                          <span className="li-badge" style={{ color: "var(--text-muted)", background: "var(--surface-2)", borderColor: "var(--border)" }}>{empType}</span>
                        )}
                        {job.experience_level && (
                          <span className="li-badge" style={{ color: expColor, background: `${expColor}1f`, borderColor: `${expColor}55` }}>
                            {job.experience_level}
                          </span>
                        )}
                        {job.is_remote && (
                          <span className="li-badge" style={{ color: "#22e597", background: "rgba(34,229,151,0.12)", borderColor: "rgba(34,229,151,0.32)" }}>Remote</span>
                        )}
                        {salaryText && (
                          <span className="li-badge li-badge-salary">{salaryText}</span>
                        )}
                      </div>

                      <div className="li-card-actions" onClick={e => e.stopPropagation()}>
                        {(job.url || job.job_url) ? (
                          <a className="li-apply-btn" href={job.url || job.job_url} target="_blank" rel="noopener noreferrer">Apply Now</a>
                        ) : (
                          <span className="li-apply-btn apply-na">No Link</span>
                        )}
                        <button className="li-prep-btn" onClick={() => onPrepInterview(job.title, job.company)}>
                          Prep Interview
                        </button>
                        {(job.source || job.source_name) && (
                          <span className="li-source-badge">{job.source || job.source_name}</span>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="li-description" onClick={e => e.stopPropagation()}>
                          {job.description || "No description available."}
                        </div>
                      )}
                    </div>
                  );
                })}
                {viewMode === "all" && hasMore && (
                  <div style={{ textAlign: "center", marginTop: "28px" }}>
                    <button className="load-more-btn" onClick={e => { e.stopPropagation(); fetchJobs(country, query, page + 1); }} disabled={loading}>
                      {loading ? <><span className="spinner" /> Loading…</> : "Load more jobs"}
                    </button>
                  </div>
                )}
              </>
            )
          )}
        </main>
      </div>
    </div>
  );
}

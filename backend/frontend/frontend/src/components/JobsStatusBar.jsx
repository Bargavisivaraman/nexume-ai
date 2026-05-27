import { useEffect, useState, memo } from "react";
import { roundedCount, timeAgo } from "../lib/format";

const API = "https://landtherole-ai.onrender.com";
const POLL_INTERVAL_MS = 30_000;

function isAdmin() {
  try { return localStorage.getItem("nexume_admin") === "1"; }
  catch { return false; }
}

/**
 * Live job-board status bar.
 *
 * Public view (default): just "X.XK+ jobs · Updated N min ago · M posted today".
 * Admin view (localStorage "nexume_admin" = "1"): expands to show per-source
 * counts, next auto-fetch ETA, and recent run logs.
 */
const JobsStatusBar = memo(function JobsStatusBar() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [admin, setAdmin] = useState(isAdmin);

  // Re-check admin flag whenever the storage event fires (Settings toggle dispatches it)
  useEffect(() => {
    const onChange = () => setAdmin(isAdmin());
    window.addEventListener("nexume_admin_change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("nexume_admin_change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer;
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API}/jobs/stats`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) { setStats(data); setError(false); }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) timer = setTimeout(fetchStats, POLL_INTERVAL_MS);
      }
    };
    fetchStats();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);

  if (!stats && !error) {
    return (
      <div className="jobs-status-bar loading">
        <span className="jobs-status-dot pulsing" />
        <span className="jobs-status-text jobs-status-skeleton">Loading job market status…</span>
      </div>
    );
  }
  if (error) {
    // Show nothing user-facing when backend is unreachable — hide the bar entirely.
    // Admins still see error inline so they can debug.
    if (!admin) return null;
    return (
      <div className="jobs-status-bar error">
        <span className="jobs-status-dot offline" />
        <span className="jobs-status-text">Backend unreachable</span>
      </div>
    );
  }

  // Posted-today metric (24h window). Falls back to server-provided count.
  const postedToday = stats.posted_in_last_24h ?? null;
  const totalLabel = roundedCount(stats.total_jobs);

  return (
    <div className={`jobs-status-bar ${admin && open ? "open" : ""}`}>
      <div
        className="jobs-status-summary"
        onClick={admin ? () => setOpen((v) => !v) : undefined}
        style={{ cursor: admin ? "pointer" : "default" }}
      >
        <span className="jobs-status-dot live" />
        <span className="jobs-status-text">
          {totalLabel && <strong>{totalLabel}</strong>}
          {totalLabel ? " jobs" : null}
          {stats.last_updated ? <> · Updated {timeAgo(stats.last_updated)}</> : null}
        </span>
        {postedToday > 0 && (
          <span className="jobs-status-new-badge">
            <span className="jobs-status-new-dot" />
            {roundedCount(postedToday)} posted today
          </span>
        )}
        <span className="jobs-status-cadence">New jobs added every 5 min</span>
        {admin && (
          <span className="jobs-status-toggle">{open ? "▴ Hide admin" : "▾ Admin"}</span>
        )}
      </div>

      {admin && open && (
        <div className="jobs-status-detail">
          <div className="jobs-status-grid">
            {Object.entries(stats.sources || {}).map(([src, count]) => (
              <div key={src} className="jobs-status-source">
                <div className="jobs-status-source-name">{src}</div>
                <div className="jobs-status-source-count">{roundedCount(count) ?? "—"}</div>
              </div>
            ))}
          </div>
          {stats.next_run && (
            <div className="jobs-status-next">
              Next auto-fetch · <strong>{timeAgo(stats.next_run).replace("ago", "from now").replace("in the future", "soon")}</strong>
            </div>
          )}
          {stats.recent_runs?.length > 0 && (
            <div className="jobs-status-runs">
              <div className="jobs-status-runs-label">Recent fetch runs</div>
              {stats.recent_runs.map((r) => (
                <div key={r.id} className="jobs-status-run">
                  <span className="jobs-status-run-time">{timeAgo(r.completed_at || r.created_at)}</span>
                  <span className="jobs-status-run-meta">
                    {r.country} · fetched <strong>{r.fetched}</strong> · inserted <strong>{r.inserted}</strong>
                    {r.errors > 0 && <span className="jobs-status-run-errors"> · {r.errors} errors</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default JobsStatusBar;

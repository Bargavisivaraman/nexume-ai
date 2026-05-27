import { useEffect, useState, memo } from "react";

const API = "https://landtherole-ai.onrender.com";
const POLL_INTERVAL_MS = 30_000;

function timeAgo(iso) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return "in the future";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function format(n) {
  if (n == null) return "—";
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

/**
 * Live job-board status bar.
 *   - Polls /jobs/stats every 30 seconds
 *   - Shows total jobs, last-updated time, new-in-last-hour badge, sources panel
 *   - Click "details" to expand source-by-source counts + recent runs
 */
const JobsStatusBar = memo(function JobsStatusBar() {
  const [stats, setStats] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);

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
        <span className="jobs-status-text">Loading job market status…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="jobs-status-bar error">
        <span className="jobs-status-dot offline" />
        <span className="jobs-status-text">Backend unreachable</span>
      </div>
    );
  }

  const hasNew = stats.new_in_last_hour > 0;

  return (
    <div className={`jobs-status-bar ${open ? "open" : ""}`}>
      <div className="jobs-status-summary" onClick={() => setOpen((v) => !v)}>
        <span className={`jobs-status-dot ${hasNew ? "live" : "idle"}`} />
        <span className="jobs-status-text">
          <strong>{format(stats.total_jobs)}</strong> jobs · updated {timeAgo(stats.last_updated)}
        </span>
        {hasNew && (
          <span className="jobs-status-new-badge">
            <span className="jobs-status-new-dot" />
            {stats.new_in_last_hour} new this hour
          </span>
        )}
        <span className="jobs-status-toggle">{open ? "▴ Hide details" : "▾ Sources"}</span>
      </div>

      {open && (
        <div className="jobs-status-detail">
          <div className="jobs-status-grid">
            {Object.entries(stats.sources || {}).map(([src, count]) => (
              <div key={src} className="jobs-status-source">
                <div className="jobs-status-source-name">{src}</div>
                <div className="jobs-status-source-count">{format(count)}</div>
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
              <div className="jobs-status-runs-label">Recent runs</div>
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

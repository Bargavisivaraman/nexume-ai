import { useState } from "react";

const PROFILE_KEY = "ltr_profile";
function loadProfile() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch { return {}; } }
function saveProfile(p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }

export default function SettingsModal({ onClose, theme, setTheme }) {
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

          {/* ── Admin (hidden by default; click 5× to enable, then toggle) ── */}
          <AdminSettingsGroup />
        </div>
      </div>
    </div>
  );
}

function AdminSettingsGroup() {
  const [adminOn, setAdminOn] = useState(() => {
    try { return localStorage.getItem("nexume_admin") === "1"; } catch { return false; }
  });
  const [unlocks, setUnlocks] = useState(0);
  const unlocked = adminOn || unlocks >= 5;

  const toggle = (next) => {
    try {
      if (next) localStorage.setItem("nexume_admin", "1");
      else      localStorage.removeItem("nexume_admin");
      window.dispatchEvent(new Event("nexume_admin_change"));
      setAdminOn(next);
    } catch { /* best effort */ }
  };

  if (!unlocked) {
    return (
      <div className="sm-group" style={{ opacity: 0.6 }}>
        <div
          className="sm-group-label"
          style={{ cursor: "pointer", userSelect: "none" }}
          onClick={() => setUnlocks(u => u + 1)}
          title="Click 5 times to unlock admin controls"
        >
          ⓘ Nexume · v1.0
        </div>
      </div>
    );
  }

  return (
    <div className="sm-group">
      <div className="sm-group-label">🛠 Admin</div>
      <div className="sm-row">
        <span className="sm-row-text">Show ingestion details on Jobs tab</span>
        <div className="theme-toggle">
          <button className={`theme-option ${adminOn ? "active" : ""}`} onClick={() => toggle(true)}>On</button>
          <button className={`theme-option ${!adminOn ? "active" : ""}`} onClick={() => toggle(false)}>Off</button>
        </div>
      </div>
      <div className="sm-empty" style={{ padding: "8px 0 0", fontSize: 11.5, textAlign: "left", lineHeight: 1.5 }}>
        Adds an "Admin" expander to the Jobs status bar showing source-by-source counts, recent ingestion runs, and next auto-fetch ETA. Users won't see this.
      </div>
    </div>
  );
}

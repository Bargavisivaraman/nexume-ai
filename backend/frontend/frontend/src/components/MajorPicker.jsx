import { useState, useEffect, useRef } from "react";
import { roundedCount } from "../lib/format";
import {
  MAJORS,
  MAJORS_BY_CATEGORY,
  MAJOR_CATEGORIES,
  MAJOR_BY_ID,
  TOTAL_ROLE_COUNT,
} from "../data/majors";

/** Categorized popover for picking a major (searches majors and their roles). */
export default function MajorPicker({ value, onChange }) {
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

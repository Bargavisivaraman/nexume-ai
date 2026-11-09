import { useState, useEffect, useRef } from "react";
import { SECTORS, SECTORS_BY_CATEGORY, SECTOR_CATEGORIES, SECTOR_BY_ID } from "../data/sectors";

/** Sticky search filter that opens a categorized sector popover. */
export default function SectorPicker({ value, onChange }) {
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

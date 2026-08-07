import { SECTOR_BY_ID, TRENDING_SECTORS } from "../data/sectors";

/** Horizontal strip of trending sector chips. */
export default function TrendingStrip({ onPick, active }) {
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

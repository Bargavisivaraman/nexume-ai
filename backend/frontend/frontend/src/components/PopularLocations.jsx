import { POPULAR_LOCATIONS } from "../data/locations";

/** Chip group for quick location filtering. */
export default function PopularLocations({ activeValue, onPick }) {
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

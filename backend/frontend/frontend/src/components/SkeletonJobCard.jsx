import { memo } from "react";

/** Loading placeholder matching the job-card layout. */
const SkeletonJobCard = memo(function SkeletonJobCard() {
  return (
    <div className="li-job-card skeleton-card">
      <div className="li-card-top">
        <div className="skeleton-line" style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="skeleton-line" style={{ width: "60%", height: "18px", marginBottom: "8px" }} />
          <div className="skeleton-line" style={{ width: "40%", height: "13px", marginBottom: "6px" }} />
          <div className="skeleton-line" style={{ width: "30%", height: "12px" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <div className="skeleton-line" style={{ width: 64, height: 20, borderRadius: 6 }} />
        <div className="skeleton-line" style={{ width: 54, height: 20, borderRadius: 6 }} />
        <div className="skeleton-line" style={{ width: 58, height: 20, borderRadius: 6 }} />
      </div>
    </div>
  );
});

export default SkeletonJobCard;

/** Per-category ATS score bars, mirroring the backend's scoring weights. */
export default function ATSBreakdown({ breakdown }) {
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

/** JD match scorecard: ring, verdict, matched/missing keywords, quick wins. */
export default function JDMatchPanel({ jd }) {
  const color = jd.verdict_color === "green" ? "#30d158" : jd.verdict_color === "yellow" ? "#ffd60a" : "#ff453a";
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (jd.match_pct / 100) * circumference;
  return (
    <div className="jd-panel reveal">
      <div className="jd-header">
        <div className="jd-circle">
          <svg width="100" height="100" viewBox="0 0 90 90">
            <circle cx="45" cy="45" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7"/>
            <circle cx="45" cy="45" r="40" fill="none" stroke={color} strokeWidth="7"
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round" transform="rotate(-90 45 45)"
              style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1) 0.3s" }}
            />
            <text x="45" y="41" textAnchor="middle" fill="white" fontSize="18" fontWeight="800">{jd.match_pct}%</text>
            <text x="45" y="55" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8">match</text>
          </svg>
        </div>
        <div className="jd-verdict">
          <span className="verdict-badge" style={{ color, borderColor: color }}>{jd.verdict}</span>
          <p>{jd.matched_keywords.length} of {jd.total_jd_keywords} job keywords found in your resume</p>
        </div>
      </div>
      {jd.missing_keywords.length > 0 && (
        <div className="jd-missing">
          <h4>Missing Keywords</h4>
          <div className="keyword-chips">
            {jd.missing_keywords.map((kw, i) => <span key={i} className="chip chip-missing">{kw}</span>)}
          </div>
        </div>
      )}
      {jd.matched_keywords.length > 0 && (
        <div className="jd-matched">
          <h4>Matched Keywords</h4>
          <div className="keyword-chips">
            {jd.matched_keywords.map((kw, i) => <span key={i} className="chip chip-matched">{kw}</span>)}
          </div>
        </div>
      )}
      {jd.suggestions.length > 0 && (
        <div className="jd-suggestions">
          <h4>Quick Wins</h4>
          <ul>{jd.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

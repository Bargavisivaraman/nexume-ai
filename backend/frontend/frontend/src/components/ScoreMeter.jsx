/** Circular ATS score meter. Green ≥75, yellow ≥50, red below. */
export default function ScoreMeter({ score }) {
  const color = score >= 75 ? "#30d158" : score >= 50 ? "#ffd60a" : "#ff453a";
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="score-meter">
      <svg width="140" height="140" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8"/>
        <circle cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)" }}
        />
        <text x="60" y="56" textAnchor="middle" fill="white" fontSize="22" fontWeight="800">{score}</text>
        <text x="60" y="72" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">/100</text>
      </svg>
      <p className="score-label">ATS Score</p>
    </div>
  );
}

/** Dual-handle salary range slider (0 to 400k in 5k steps). */
export default function SalaryRange({ value, onChange }) {
  const [min, max] = value;
  return (
    <div className="salary-range-control">
      <div className="salary-range-header">
        <span>Salary</span>
        <span className="salary-range-value">
          ${(min/1000).toFixed(0)}k <span style={{ opacity: 0.4 }}>–</span> {max >= 400000 ? "400k+" : `$${(max/1000).toFixed(0)}k`}
        </span>
      </div>
      <div className="salary-range-track">
        <input
          type="range" min={0} max={400000} step={5000}
          value={min}
          onChange={e => onChange([Math.min(+e.target.value, max - 5000), max])}
          className="salary-range-slider min"
        />
        <input
          type="range" min={0} max={400000} step={5000}
          value={max}
          onChange={e => onChange([min, Math.max(+e.target.value, min + 5000)])}
          className="salary-range-slider max"
        />
      </div>
    </div>
  );
}

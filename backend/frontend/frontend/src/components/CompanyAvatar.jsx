/**
 * CompanyAvatar — deterministic gradient avatar from a company name.
 * The hue is derived from the name so a company always gets the same color.
 */
export default function CompanyAvatar({ name, size = 48 }) {
  const initials = name
    ? name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "?";
  const hue = name ? [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360 : 260;
  return (
    <div
      className="company-avatar"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue},50%,28%) 0%, hsl(${(hue + 40) % 360},55%,22%) 100%)`,
        border: `1px solid hsl(${hue},50%,38%)`,
      }}
    >
      <span
        style={{
          color: `hsl(${hue},80%,82%)`,
          fontSize: size * 0.36,
          fontWeight: 800,
          letterSpacing: "-0.04em",
        }}
      >
        {initials}
      </span>
    </div>
  );
}

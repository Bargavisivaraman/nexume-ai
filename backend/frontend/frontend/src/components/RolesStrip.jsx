import { roundedCount } from "../lib/format";
import { MAJOR_BY_ID } from "../data/majors";

/** Horizontal scrollable role chips for the selected major. */
export default function RolesStrip({ majorId, activeRoleId, onPickRole }) {
  if (!majorId) return null;
  const major = MAJOR_BY_ID[majorId];
  if (!major) return null;
  return (
    <div className="jobs-roles-strip">
      <div className="jobs-roles-strip-header">
        <span className="jobs-roles-strip-label">
          <span className="jobs-roles-strip-emoji">{major.emoji}</span>
          <strong>{major.label}</strong>
          <span className="jobs-roles-strip-count">{roundedCount(major.roles.length)} roles</span>
        </span>
      </div>
      <div className="jobs-roles-strip-pills">
        {major.roles.map(role => (
          <button
            key={role.id}
            className={`jobs-role-pill ${activeRoleId === role.id ? "active" : ""}`}
            onClick={() => onPickRole(activeRoleId === role.id ? null : role.id)}
          >
            {role.label}
          </button>
        ))}
      </div>
    </div>
  );
}

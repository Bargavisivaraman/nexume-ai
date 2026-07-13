/**
 * Badge colors for job cards. INDUSTRY_COLORS must stay in sync with the
 * backend's INDUSTRY_MAP (jobs.py) — every industry the API can return needs
 * a color, with "Other" as the fallback bucket.
 */

export const INDUSTRY_COLORS = {
  "Technology":          "#7c3aff",
  "Healthcare":          "#22e597",
  "Education":           "#ff9f0a",
  "Finance":             "#60a5fa",
  "Legal":               "#ffce47",
  "Marketing":           "#ff5d8f",
  "Sales":               "#ff7a59",
  "Design & Creative":   "#d946ef",
  "Human Resources":     "#a78bfa",
  "Supply Chain":        "#fbbf24",
  "Engineering":         "#9ca3af",
  "Government":          "#64d2ff",
  "Research & Science":  "#34d399",
  "Retail & Hospitality":"#fb7185",
  "Business":            "#c084fc",
  "Other":               "#94a3b8",
};

export const EXP_COLORS = {
  "Entry Level": "#22e597",
  "Mid Level":   "#60a5fa",
  "Senior":      "#ff9f0a",
  "Executive":   "#ffce47",
};

/**
 * Query expansion — abbreviations, typo corrections, and hyphen normalization.
 *
 * Used to transform what the user typed into a query the backend can actually
 * match against. Backend uses Postgres ILIKE so it has no fuzzy matching of
 * its own; this layer compensates.
 *
 *   expandSearchQuery("SWE")           → "software engineer"
 *   expandSearchQuery("PM")            → "product manager"
 *   expandSearchQuery("software enginner") → "software engineer"
 *   expandSearchQuery("front-end")     → "frontend"
 *   expandSearchQuery("data scientest") → "data scientist"
 */

// ── Abbreviations (whole-string OR per-token expansion) ──────────────────────
// These are matched as whole tokens or full input strings.
const ABBREVIATIONS = {
  // Engineering
  swe:    "software engineer",
  sde:    "software engineer",
  sde1:   "software engineer",
  sde2:   "software engineer",
  sse:    "senior software engineer",
  fe:     "frontend engineer",
  be:     "backend engineer",
  fs:     "full stack engineer",
  sre:    "site reliability engineer",
  // Data / ML
  ml:     "machine learning",
  dl:     "deep learning",
  ds:     "data scientist",
  da:     "data analyst",
  de:     "data engineer",
  ai:     "ai engineer",
  nlp:    "natural language processing",
  // Product / PM
  pm:     "product manager",
  apm:    "associate product manager",
  gpm:    "group product manager",
  tpm:    "technical program manager",
  pmm:    "product marketing manager",
  // Design
  ux:     "ux designer",
  ui:     "ui designer",
  uxr:    "ux researcher",
  // Sales / GTM
  ae:     "account executive",
  sdr:    "sales development representative",
  bdr:    "business development representative",
  csm:    "customer success manager",
  rev:    "revenue operations",
  bizops: "business operations",
  // Eng leadership / business
  em:     "engineering manager",
  ic:     "individual contributor",
  vp:     "vice president",
  cto:    "chief technology officer",
  ceo:    "chief executive officer",
  coo:    "chief operating officer",
  cfo:    "chief financial officer",
  cmo:    "chief marketing officer",
  // QA / Security
  qa:     "quality assurance engineer",
  sdet:   "software development engineer in test",
  soc:    "security operations",
  // Finance / business
  ba:     "business analyst",
  ib:     "investment banking",
  pe:     "private equity",
  vc:     "venture capital",
  hr:     "human resources",
  it:     "information technology",
  // Healthcare
  rn:     "registered nurse",
  lpn:    "licensed practical nurse",
  pa:     "physician assistant",
  ot:     "occupational therapist",
  pt:     "physical therapist",
  slp:    "speech language pathologist",
  bcba:   "board certified behavior analyst",
  // Academic
  cs:     "computer science",
  ee:     "electrical engineering",
  me:     "mechanical engineering",
};

// ── Typo corrections (per-token, case-insensitive) ───────────────────────────
const TYPOS = {
  enginner:   "engineer",
  engeneer:   "engineer",
  enginer:    "engineer",
  developper: "developer",
  developr:   "developer",
  developor:  "developer",
  programer:  "programmer",
  desginer:   "designer",
  desinger:   "designer",
  analist:    "analyst",
  anlayst:    "analyst",
  analsyt:    "analyst",
  managment:  "management",
  managemnet: "management",
  managar:    "manager",
  scientest:  "scientist",
  scientest:  "scientist",
  scientis:   "scientist",
  develper:   "developer",
  cybersecuirty: "cybersecurity",
  cybersecuity:  "cybersecurity",
  cyber:      "cybersecurity",
};

// ── Hyphen / space normalization ─────────────────────────────────────────────
// Keep the more common variant; backend ILIKE on either form will hit.
const HYPHEN_VARIANTS = [
  ["front-end", "frontend"],
  ["front end", "frontend"],
  ["back-end",  "backend"],
  ["back end",  "backend"],
  ["full-stack", "full stack"],
  ["fullstack",  "full stack"],
  ["e-commerce", "ecommerce"],
  ["data-driven", "data driven"],
];

/**
 * expandSearchQuery — primary entry point. Idempotent.
 * Returns the query the backend should be hit with (single string).
 */
export function expandSearchQuery(raw) {
  if (!raw) return raw;
  const lower = String(raw).toLowerCase().trim();
  if (!lower) return raw;

  // 1. Whole-string abbreviation match (most precise)
  if (ABBREVIATIONS[lower]) return ABBREVIATIONS[lower];

  // 2. Per-token expansion + typo correction
  let tokens = lower.split(/\s+/);
  tokens = tokens.map((t) => {
    // Strip trailing punctuation for the lookup
    const stripped = t.replace(/[.,;:!?]+$/, "");
    if (ABBREVIATIONS[stripped]) return ABBREVIATIONS[stripped];
    if (TYPOS[stripped])         return TYPOS[stripped];
    return t;
  });
  let result = tokens.join(" ");

  // 3. Hyphen / space normalization
  for (const [from, to] of HYPHEN_VARIANTS) {
    if (result.includes(from)) result = result.split(from).join(to);
  }

  return result;
}

/**
 * suggestAlternatives — return a short list of expanded variants for richer
 * matching, e.g. ["frontend", "front-end", "front end"]. The frontend can OR
 * these together in a multi-keyword query if backend supports it.
 *
 * Currently the backend only takes one keyword; we return [expanded] only.
 * Kept as a future hook.
 */
export function suggestAlternatives(raw) {
  const expanded = expandSearchQuery(raw);
  return Array.from(new Set([raw, expanded].filter(Boolean)));
}

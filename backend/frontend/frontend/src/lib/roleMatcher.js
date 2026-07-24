/**
 * Universal Role Matcher
 * =======================
 *
 * Filters and scores jobs against a selected role. The system covers all 1900+
 * roles via "role families" — each family bundles strict include keywords,
 * required-any keywords, exclusion keywords, and supporting skills.
 *
 * scoreJobForRole(job, role, major) → 0..100
 *   - 0  = does not match the role at all (filter out)
 *   - ≥60 = above relevance threshold (show)
 *   - 100 = perfect match (title + description + skills all align)
 *
 * Logic order:
 *   1. Build include / exclude / skill sets from family + role label
 *   2. HARD REJECT if title contains an exclude keyword that is not also
 *      part of this role's include set
 *   3. Title must contain ≥1 required-any keyword
 *   4. Score = base + title hits + description hits + skill hits
 */

// ── ROLE FAMILY RULES ────────────────────────────────────────────────────────
// Each family covers the dozens of role variants in that domain. Adding a new
// family here automatically improves accuracy for every role that matches it.

const FAMILIES = {
  frontend: {
    requiredAny: [
      "frontend", "front-end", "front end",
      "react developer", "react engineer", "vue developer", "angular developer", "svelte",
      "ui engineer", "ui developer", "javascript engineer", "javascript developer",
      "typescript engineer", "web developer", "web engineer", "web frontend",
    ],
    exclude: [
      "backend", "back-end", "back end", "full stack", "full-stack", "fullstack",
      "data engineer", "data analyst", "data scientist", "data architect",
      "machine learning", "ml engineer", "ai engineer", "research scientist",
      "devops", "site reliability", "platform engineer", "infrastructure engineer",
      "security engineer", "cybersecurity", "soc analyst",
      "solutions architect", "systems administrator", "network engineer", "network admin",
      "qa engineer", "test engineer", "automation engineer",
      "product manager", "product owner", "project manager", "program manager",
      "designer", "graphic", "ux designer", "ui designer", "product designer",
      "engineering manager", "director of engineering",
    ],
    skills: ["react", "vue", "angular", "svelte", "javascript", "typescript", "next.js", "nuxt", "tailwind", "css", "html", "redux", "webpack", "vite"],
  },

  backend: {
    requiredAny: [
      "backend", "back-end", "back end",
      "server engineer", "api engineer", "platform engineer",
      "python developer", "java developer", "go developer", "golang", "rust developer",
      "node.js developer", "node developer", "ruby on rails", "elixir developer",
      "scala developer", "kotlin developer", "spring developer",
    ],
    exclude: [
      "frontend", "front-end", "front end", "full stack", "full-stack", "fullstack",
      "data analyst", "data scientist", "data engineer",
      "machine learning", "ml engineer", "ai engineer", "research scientist",
      "site reliability", "devops", "security engineer", "cybersecurity",
      "solutions architect", "systems administrator", "network engineer",
      "designer", "graphic", "ux", "ui designer",
      "product manager", "product owner", "project manager", "program manager",
      "qa engineer", "test engineer",
    ],
    skills: ["python", "java", "go", "rust", "node.js", "django", "flask", "fastapi", "spring", "rails", "express", "postgres", "mongodb", "redis", "kafka"],
  },

  fullstack: {
    requiredAny: ["full stack", "full-stack", "fullstack"],
    exclude: [
      "data engineer", "data scientist", "data analyst",
      "machine learning", "ml engineer", "ai engineer",
      "devops", "site reliability", "security engineer", "cybersecurity",
      "product manager", "project manager", "program manager", "qa engineer",
      "designer", "ux", "ui designer",
    ],
    skills: ["react", "node.js", "typescript", "python", "django", "express", "postgres", "javascript"],
  },

  mobile_dev: {
    requiredAny: ["ios developer", "android developer", "mobile developer", "mobile engineer", "react native", "flutter developer", "swift developer", "kotlin developer"],
    exclude: ["frontend", "backend", "data", "machine learning", "designer", "product manager", "qa engineer"],
    skills: ["swift", "kotlin", "react native", "flutter", "objective-c"],
  },

  // — Data family —
  data_analyst: {
    requiredAny: ["data analyst", "business intelligence analyst", "bi analyst", "analytics analyst", "reporting analyst"],
    exclude: [
      "data engineer", "data scientist", "machine learning", "ml engineer", "ai engineer",
      "business analyst", "marketing analyst", "financial analyst", "operations analyst",
      "risk analyst", "credit analyst", "investment analyst", "research analyst",
      "product analyst", "growth analyst", "fraud analyst",
      "data architect", "database administrator", "data platform",
    ],
    skills: ["sql", "tableau", "power bi", "looker", "excel", "google analytics"],
  },

  data_scientist: {
    requiredAny: ["data scientist", "applied scientist"],
    exclude: [
      "data engineer", "data analyst", "data architect", "ml engineer", "ai engineer",
      "research engineer", "research scientist", "business analyst",
    ],
    skills: ["python", "r", "sql", "pandas", "scikit-learn", "tensorflow", "pytorch", "statistics", "machine learning"],
  },

  data_engineer: {
    requiredAny: ["data engineer", "etl engineer", "data platform engineer", "analytics engineer", "data infrastructure"],
    exclude: ["data scientist", "data analyst", "ml engineer", "ai engineer", "backend engineer", "software engineer", "business analyst"],
    skills: ["sql", "python", "spark", "airflow", "snowflake", "dbt", "kafka", "redshift", "bigquery"],
  },

  ml_engineer: {
    requiredAny: [
      "machine learning engineer", "ml engineer", "ai engineer",
      "deep learning engineer", "nlp engineer", "computer vision engineer",
      "applied ml", "ml platform", "ml ops", "mlops engineer",
      "generative ai engineer", "llm engineer",
    ],
    exclude: [
      "data scientist", "data engineer", "data analyst",
      "research scientist", "applied scientist",
      "product manager", "business analyst", "sales", "marketing",
    ],
    skills: ["python", "pytorch", "tensorflow", "huggingface", "machine learning", "deep learning", "mlops", "llm", "transformers"],
  },

  // — Infrastructure family —
  devops_sre: {
    requiredAny: [
      "devops", "site reliability", "sre", "platform engineer",
      "infrastructure engineer", "kubernetes engineer", "cloud engineer",
      "production engineer", "reliability engineer", "build engineer", "release engineer",
    ],
    exclude: [
      "frontend", "backend", "full stack", "full-stack",
      "data analyst", "data scientist", "ml engineer", "ai engineer",
      "security engineer", "cybersecurity",
      "designer", "product manager", "project manager",
    ],
    skills: ["aws", "kubernetes", "docker", "terraform", "ci/cd", "linux", "ansible", "prometheus", "grafana"],
  },

  // — Security family —
  cybersecurity: {
    requiredAny: [
      "security analyst", "security engineer", "cybersecurity", "infosec", "information security",
      "soc analyst", "soc engineer", "incident response", "threat intelligence",
      "vulnerability", "penetration tester", "pentest", "appsec", "application security",
      "security operations", "security architect", "iam engineer",
    ],
    exclude: [
      "it support", "help desk", "desktop support",
      "systems administrator", "network administrator", "system admin",
      "software engineer", "data engineer", "data analyst",
      "product manager", "project manager",
    ],
    skills: ["siem", "splunk", "owasp", "penetration", "compliance", "soc 2", "nist", "iso 27001", "ids", "ips"],
  },

  // — Design family —
  ux_product_design: {
    requiredAny: [
      "ux designer", "ui designer", "ui/ux designer", "product designer",
      "interaction designer", "ux researcher", "user researcher", "user experience",
      "design systems designer", "service designer", "ux writer",
    ],
    exclude: [
      "graphic designer", "visual designer", "brand designer", "marketing designer",
      "industrial designer", "interior designer", "fashion designer", "illustrator",
      "video editor", "motion designer", "engineer", "developer",
    ],
    skills: ["figma", "sketch", "adobe xd", "user research", "wireframe", "prototyping"],
  },

  graphic_design: {
    requiredAny: ["graphic designer", "visual designer", "brand designer", "marketing designer", "creative designer"],
    exclude: ["ux designer", "ui designer", "product designer", "interaction designer", "industrial designer", "engineer", "developer"],
    skills: ["adobe", "photoshop", "illustrator", "indesign", "after effects", "figma"],
  },

  // — Product family —
  product_manager: {
    requiredAny: [
      "product manager", "product owner", "apm", "associate product manager",
      "senior product manager", "principal product manager", "group product manager", "gpm",
      "head of product", "vp product", "director of product", "chief product officer",
      "product lead",
    ],
    exclude: [
      "project manager", "program manager", "technical program manager", "tpm",
      "product marketing", "marketing manager", "engineering manager", "design manager",
      "operations manager", "account manager",
    ],
    skills: ["roadmap", "user research", "a/b testing", "sql", "stakeholder"],
  },

  project_program_manager: {
    requiredAny: ["project manager", "program manager", "technical program manager", "tpm", "project coordinator", "program coordinator"],
    exclude: ["product manager", "product owner", "marketing manager", "engineering manager"],
    skills: ["pmp", "agile", "scrum", "jira"],
  },

  // — Marketing family —
  marketing: {
    requiredAny: [
      "marketing manager", "marketing specialist", "marketing coordinator", "marketing director",
      "marketing analyst", "growth marketer", "growth marketing", "demand generation",
      "performance marketer", "brand manager", "brand marketing",
      "content marketing", "content marketer", "social media manager", "seo specialist",
      "sem specialist", "email marketing", "lifecycle marketing", "product marketing", "pmm",
      "marketing operations", "field marketing", "event marketing", "partner marketing",
    ],
    exclude: ["engineer", "developer", "designer", "data scientist", "data engineer", "product manager"],
    skills: ["seo", "sem", "hubspot", "marketo", "google analytics", "salesforce"],
  },

  // — Sales family —
  sales: {
    requiredAny: [
      "account executive", "sales representative", "sales rep", "sales engineer",
      "sdr", "bdr", "sales development", "business development representative",
      "inside sales", "outside sales", "field sales", "account manager",
      "customer success manager", "csm", "customer success", "renewals manager",
      "revenue operations", "sales operations",
      "vp sales", "head of sales", "director of sales", "regional sales",
    ],
    exclude: ["product marketing", "marketing manager", "engineer", "designer", "data"],
    skills: ["salesforce", "outreach", "hubspot", "linkedin"],
  },

  // — Business / Ops / Finance —
  business_analyst: {
    requiredAny: ["business analyst", "business systems analyst", "operations analyst", "business intelligence analyst"],
    exclude: ["data analyst", "financial analyst", "marketing analyst", "data scientist", "data engineer", "ml engineer"],
    skills: ["sql", "excel", "tableau", "power bi"],
  },

  financial_analyst: {
    requiredAny: ["financial analyst", "fp&a analyst", "fp&a", "corporate finance", "treasury analyst", "investment analyst", "equity research"],
    exclude: ["data analyst", "business analyst", "marketing analyst", "engineer", "developer"],
    skills: ["excel", "financial modeling", "valuation", "dcf"],
  },

  accountant: {
    requiredAny: ["accountant", "staff accountant", "senior accountant", "controller", "cpa", "tax accountant", "auditor", "internal auditor"],
    exclude: ["data analyst", "business analyst", "engineer", "developer", "marketing"],
    skills: ["gaap", "quickbooks", "netsuite", "sap"],
  },

  // — Healthcare —
  nurse: {
    requiredAny: ["registered nurse", "rn", "lpn", "licensed practical nurse", "nurse practitioner", "icu nurse", "er nurse", "or nurse", "school nurse", "travel nurse", "charge nurse"],
    exclude: ["engineer", "developer", "designer", "manager"],
    skills: [],
  },

  // — Education —
  teacher: {
    requiredAny: ["teacher", "instructor", "tutor", "professor", "lecturer", "educator", "school counselor"],
    exclude: ["engineer", "developer", "designer", "data scientist", "machine learning"],
    skills: [],
  },

  // — Legal —
  legal: {
    requiredAny: ["attorney", "lawyer", "paralegal", "legal assistant", "counsel", "litigation", "law clerk", "judicial clerk"],
    exclude: ["engineer", "developer", "designer", "data scientist", "compliance officer"],
    skills: [],
  },

  // — QA —
  qa_test: {
    requiredAny: ["qa engineer", "quality assurance engineer", "test engineer", "test automation engineer", "sdet", "qa analyst", "quality engineer"],
    exclude: ["frontend", "backend", "full stack", "data engineer", "ml engineer", "product manager", "designer"],
    skills: ["selenium", "cypress", "playwright", "jest", "automation"],
  },

  // — Hardware / Mech —
  mech_eng: {
    requiredAny: ["mechanical engineer", "mech engineer", "mechatronics", "thermal engineer", "hvac engineer", "cad designer", "fea engineer", "solidworks"],
    exclude: ["software", "data engineer", "data scientist", "marketing"],
    skills: ["solidworks", "autocad", "ansys", "matlab"],
  },

  elec_eng: {
    requiredAny: ["electrical engineer", "electronics engineer", "fpga engineer", "asic engineer", "rf engineer", "power engineer", "hardware engineer", "pcb designer"],
    exclude: ["software", "data engineer", "data scientist", "marketing"],
    skills: ["verilog", "vhdl", "altium", "spice", "matlab"],
  },
};

// ── FAMILY INFERENCE ─────────────────────────────────────────────────────────
// Given a role label, pick the best matching family. Returns null when no
// pattern matches — in that case the matcher falls back to using just the
// role label as the required keyword.

const FAMILY_PATTERNS = [
  // most specific first
  [/\b(frontend|front-end|front end|react developer|vue developer|angular developer|ui engineer|ui developer|web frontend|javascript engineer|svelte)\b/i, "frontend"],
  [/\b(full[\s-]?stack)\b/i, "fullstack"],
  [/\b(backend|back-end|back end|api engineer|server engineer|node\.js developer|python developer|java developer|go developer|rust developer|ruby developer|kotlin developer|scala developer|ruby on rails|spring developer)\b/i, "backend"],
  [/\b(ios developer|android developer|mobile developer|mobile engineer|react native|flutter|swift developer|kotlin developer)\b/i, "mobile_dev"],

  [/\b(data analyst|business intelligence analyst|bi analyst|analytics analyst|reporting analyst)\b/i, "data_analyst"],
  [/\b(data scientist|applied scientist)\b/i, "data_scientist"],
  [/\b(data engineer|etl engineer|analytics engineer|data platform|data infrastructure)\b/i, "data_engineer"],
  [/\b(machine learning|ml engineer|ml ops|mlops|ai engineer|deep learning|nlp engineer|computer vision engineer|generative ai|llm engineer|applied ml)\b/i, "ml_engineer"],

  [/\b(devops|site reliability|sre|platform engineer|infrastructure engineer|cloud engineer|kubernetes engineer|production engineer|reliability engineer|build engineer|release engineer)\b/i, "devops_sre"],
  [/\b(security|cybersecurity|infosec|soc analyst|incident response|threat|vulnerability|penetration tester|appsec|application security|iam engineer)\b/i, "cybersecurity"],

  [/\b(ux designer|ui designer|ui\/ux|product designer|interaction designer|ux researcher|user researcher|design systems|service designer|ux writer)\b/i, "ux_product_design"],
  [/\b(graphic designer|visual designer|brand designer|marketing designer|creative designer)\b/i, "graphic_design"],

  [/\b(product manager|product owner|apm|associate product manager|head of product|vp product|chief product officer|director of product|product lead)\b/i, "product_manager"],
  [/\b(project manager|program manager|technical program manager|tpm|project coordinator|program coordinator)\b/i, "project_program_manager"],

  [/\b(marketing|growth marketing|brand manager|content marketing|seo specialist|sem specialist|social media manager|email marketing|product marketing|pmm|marketing operations|martech|field marketing|partner marketing|demand generation)\b/i, "marketing"],
  [/\b(account executive|sales rep|sales engineer|sdr|bdr|sales development|inside sales|outside sales|account manager|customer success|csm|business development|revenue operations)\b/i, "sales"],

  [/\b(business analyst|business systems analyst|operations analyst|business intelligence analyst)\b/i, "business_analyst"],
  [/\b(financial analyst|fp&a|corporate finance|treasury analyst|investment analyst|equity research)\b/i, "financial_analyst"],
  [/\b(accountant|staff accountant|controller|cpa|tax accountant|auditor)\b/i, "accountant"],

  [/\b(registered nurse|\brn\b|\blpn\b|licensed practical nurse|nurse practitioner|icu nurse|er nurse|or nurse|travel nurse|charge nurse|school nurse)\b/i, "nurse"],
  [/\b(teacher|instructor|tutor|professor|lecturer|educator|school counselor)\b/i, "teacher"],
  [/\b(attorney|lawyer|paralegal|legal assistant|counsel|litigation)\b/i, "legal"],

  [/\b(qa engineer|quality assurance engineer|test engineer|test automation|sdet|qa analyst|quality engineer)\b/i, "qa_test"],
  [/\b(mechanical engineer|mech engineer|mechatronics|hvac engineer|cad designer|fea engineer|solidworks)\b/i, "mech_eng"],
  [/\b(electrical engineer|electronics engineer|fpga|asic|rf engineer|power engineer|hardware engineer|pcb designer)\b/i, "elec_eng"],
];

function inferFamily(roleLabel) {
  if (!roleLabel) return null;
  for (const [pattern, family] of FAMILY_PATTERNS) {
    if (pattern.test(roleLabel)) return family;
  }
  return null;
}

// ── SCORER ───────────────────────────────────────────────────────────────────

function buildScoringRules(role) {
  const family = inferFamily(role.label);
  const rules = family ? FAMILIES[family] : {};

  // Always include the role's own label as a strong match keyword
  const includes = new Set([role.label.toLowerCase()]);
  (rules.requiredAny || []).forEach((k) => includes.add(k.toLowerCase()));

  const excludes = new Set();
  (rules.exclude || []).forEach((k) => {
    const lower = k.toLowerCase();
    // Don't exclude something that's an explicit include for this role
    if (!includes.has(lower)) excludes.add(lower);
  });

  const skills = new Set((rules.skills || []).map((s) => s.toLowerCase()));

  return { includes: [...includes], excludes: [...excludes], skills: [...skills], family };
}

/**
 * Score a job's relevance for a target role (0..100).
 * Returns 0 to indicate the job should be filtered out entirely.
 */
export function scoreJobForRole(job, role, _major) {
  if (!job || !role) return 100;
  const title = (job.title || "").toLowerCase();
  if (!title) return 0;

  const { includes, excludes, skills } = buildScoringRules(role);

  // 1. Hard reject if title contains an exclude keyword
  for (const excl of excludes) {
    // Word-boundary-ish: require the exclude to appear as its own phrase
    if (title.includes(excl)) return 0;
  }

  // 2. Title must contain at least one include keyword
  let titleHits = 0;
  for (const inc of includes) {
    if (title.includes(inc)) titleHits++;
  }
  if (titleHits === 0) return 0;

  // 3. Base score from title strength
  let score = 55 + Math.min(25, titleHits * 12);

  // 4. Description match bonus
  const desc = (job.description || "").toLowerCase();
  if (desc) {
    let descHits = 0;
    for (const inc of includes) {
      if (desc.includes(inc)) descHits++;
    }
    score += Math.min(12, descHits * 2);
  }

  // 5. Skill match bonus (description + tech_stack)
  const techStack = (job.tech_stack || []).map((t) => (typeof t === "string" ? t.toLowerCase() : ""));
  let skillHits = 0;
  for (const s of skills) {
    if (desc.includes(s) || techStack.includes(s)) skillHits++;
  }
  score += Math.min(12, skillHits * 3);

  return Math.min(100, Math.round(score));
}

export const RELEVANCE_THRESHOLD = 60;

// ── MAJOR-LEVEL RULES ────────────────────────────────────────────────────────
// Used when a user picks a major WITHOUT picking a specific role. Without these
// rules, picking "Physics" returns every Research & Science job in the DB —
// including unrelated "Research Scientist - Music" titles. These rules anchor
// the feed to titles/descriptions that actually belong to the major.

const MAJOR_RULES = {
  // STEM
  physics: {
    requiredAny: ["physics", "physicist", "quantum", "optic", "photonic", "laser", "plasma", "astro", "atmospher", "geophys", "semiconductor", "materials science", "imaging scientist", "computational physics", "applied physics", "nuclear engineer", "medical physic"],
    exclude: ["music", "marketing", "sales", "support specialist", "social media", "fashion", "retail", "hospitality"],
  },
  mathematics: {
    requiredAny: ["math", "quant", "statistic", "actuari", "cryptograph", "algorithm", "operations research"],
    exclude: ["english teacher", "marketing", "sales", "hospitality"],
  },
  chemistry: {
    requiredAny: ["chemist", "chemical", "biochem", "pharm", "polymer", "analytical", "drug discovery", "lab scientist", "formulation"],
    exclude: ["music", "marketing", "social media", "hospitality"],
  },
  biology: {
    requiredAny: ["biolog", "molecular", "microbio", "geneticist", "bioinformat", "ecolog", "wildlife", "marine biolog", "conservation biolog"],
    exclude: ["music", "marketing", "fashion", "hospitality"],
  },
  "biomedical-engineering": {
    requiredAny: ["biomedical", "medical device", "biotech", "tissue", "biomechan", "bioinformat", "clinical engineer", "prosthet", "biomedical software"],
    exclude: ["music", "fashion", "hospitality"],
  },
  "materials-science": {
    requiredAny: ["material", "polymer", "metallurg", "compos", "ceramic", "semiconductor", "nanotech", "coating", "catalyst", "battery"],
    exclude: ["music", "marketing", "hospitality"],
  },
  "data-science": {
    requiredAny: ["data scientist", "data analyst", "machine learning", "ml engineer", "ml ops", "analytics", "statistician", "biostat", "applied scientist", "quantitative", "bi engineer"],
    exclude: ["music", "fashion", "hospitality"],
  },
  "information-technology": {
    requiredAny: ["it ", "support", "sysadmin", "system admin", "network", "help desk", "security analyst", "it manager", "infrastructure", "service desk"],
    exclude: ["music", "fashion", "hospitality", "marketing"],
  },

  // HEALTHCARE (these majors usually self-anchor via specific titles)
  nursing: {
    requiredAny: ["nurse", "rn", "lpn", "lvn", "cna", "nursing", "nurse practitioner"],
    exclude: ["engineer", "developer", "designer", "marketing", "sales", "fashion"],
  },
  pharmacy: {
    requiredAny: ["pharmac", "drug ", "medication"],
    exclude: ["engineer", "developer", "designer", "marketing", "music", "fashion"],
  },
  "pre-med": {
    requiredAny: ["physician", "medical", "clinical", "patient", "hospital", "physician assistant", "scribe", "phlebotom", "doctor"],
    exclude: ["engineer", "designer", "marketing", "fashion", "developer", "music"],
  },
  "health-administration": {
    requiredAny: ["healthcare", "hospital", "medical", "clinic", "patient", "health services", "revenue cycle", "medical coder", "case manager"],
    exclude: ["engineer", "developer", "music", "fashion"],
  },
  psychology: {
    requiredAny: ["psycholog", "therap", "counsel", "behavior", "social work", "mental health", "lcsw", "ux research", "behavioral research"],
    exclude: ["engineer", "developer", "marketing", "music", "fashion", "sales"],
  },
  "public-health": {
    requiredAny: ["public health", "epidemiol", "community health", "global health", "health policy", "biostat", "population health"],
    exclude: ["engineer", "developer", "marketing", "music", "fashion"],
  },

  // LAW & PUBLIC
  "pre-law": {
    requiredAny: ["attorney", "lawyer", "paralegal", "legal", "law clerk", "counsel", "litigation", "compliance"],
    exclude: ["engineer", "developer", "designer", "marketing", "music", "fashion"],
  },
  "criminal-justice": {
    requiredAny: ["police", "officer", "detective", "investigator", "corrections", "forensic", "law enforcement", "security officer"],
    exclude: ["engineer", "developer", "designer", "music", "marketing"],
  },

  // EDUCATION
  "elementary-education": {
    requiredAny: ["elementary teacher", "kindergarten", "first grade", "second grade", "third grade", "fourth grade", "fifth grade", "reading specialist", "paraprofess", "teacher assistant"],
    exclude: ["engineer", "developer", "designer", "marketing", "music industry", "fashion"],
  },
  "secondary-education": {
    requiredAny: ["high school", "middle school", "math teacher", "english teacher", "science teacher", "history teacher", "school counsel", "ap teacher", "honors teacher"],
    exclude: ["engineer", "developer", "marketing", "fashion"],
  },
  "special-education": {
    requiredAny: ["special education", "sped", "iep", "bcba", "rbt", "speech language", "slp", "behavior tech", "autism", "occupational therap", "physical therap"],
    exclude: ["engineer", "developer", "marketing", "music", "fashion"],
  },

  // ARTS / DESIGN — narrow majors get their family rules from inferFamily()
  // (graphic-design, ux-ui-design) but standalone majors benefit from a guard:
  "fine-arts": {
    requiredAny: ["artist", "illustrator", "painter", "sculpt", "photograph", "ceramic", "printmaker", "curator", "gallery", "art teacher", "art therap"],
    exclude: ["engineer", "developer", "marketing manager", "data scientist", "data engineer"],
  },
  architecture: {
    requiredAny: ["architect", "architectural", "interior designer", "urban", "landscape architect", "bim", "revit", "autocad architect"],
    exclude: ["software architect", "solutions architect", "cloud architect", "data architect", "marketing", "music"],
  },
  "film-media": {
    requiredAny: ["video editor", "film", "cinematograph", "producer", "director", "production assistant", "vfx", "compositor", "animator", "colorist", "sound design"],
    exclude: ["software", "data engineer", "marketing manager", "product manager"],
  },
  "music-performing-arts": {
    requiredAny: ["music", "musician", "audio", "composer", "songwriter", "performer", "actor", "dancer", "tour manager", "music producer"],
    exclude: ["software", "data engineer", "marketing", "research scientist"],
  },

  // TRADES
  "hospitality-tourism": {
    requiredAny: ["hospitality", "hotel", "guest service", "concierge", "front desk", "reservations", "banquet", "event coordinator", "wedding planner", "travel agent", "tourism"],
    exclude: ["software", "data engineer", "designer", "marketing"],
  },
  "culinary-arts": {
    requiredAny: ["chef", "cook", "kitchen", "culinary", "pastry", "baker", "sushi", "barista", "bartender", "sommelier"],
    exclude: ["software", "engineer", "developer", "data"],
  },
  "construction-management": {
    requiredAny: ["construction", "field engineer construct", "estimator", "site superintend", "scheduler", "safety construct", "permit", "building inspect", "concrete", "steel"],
    exclude: ["software", "data", "marketing"],
  },
};

/**
 * Score a job's relevance to a target MAJOR (no role picked).
 * Returns 0..100; 0 means filter out.
 *
 * Behavior:
 *   - Hard-rejects jobs whose title contains a major-level exclude
 *   - Requires at least one major-level required keyword in title OR description
 *   - Falls back to "title must contain at least one of the major's role labels"
 *     when no explicit rule exists
 */
export function scoreJobForMajor(job, major) {
  if (!job || !major) return 100;
  const title = (job.title || "").toLowerCase();
  const desc = (job.description || "").toLowerCase();
  if (!title) return 0;

  const rule = MAJOR_RULES[major.id];

  if (rule) {
    // Hard reject on excludes
    for (const ex of rule.exclude || []) {
      if (title.includes(ex)) return 0;
    }
    // Require at least one anchor keyword
    const inTitle = (rule.requiredAny || []).some((kw) => title.includes(kw));
    const inDesc  = (rule.requiredAny || []).some((kw) => desc.includes(kw));
    if (!inTitle && !inDesc) return 0;
    return inTitle ? 85 : 65;
  }

  // No explicit rule — use the union of role label/keywords as include set
  const allKw = (major.roles || []).flatMap((r) =>
    [r.label.toLowerCase(), ...(r.keywords || []).map((k) => k.toLowerCase())]
  );
  if (allKw.some((kw) => title.includes(kw))) return 80;
  if (allKw.some((kw) => desc.includes(kw))) return 62;
  return 0;
}

export function filterJobsForMajor(jobs, major) {
  if (!major || !Array.isArray(jobs)) return jobs;
  return jobs
    .map((j) => ({ ...j, _majorRelevance: scoreJobForMajor(j, major) }))
    .filter((j) => (j._majorRelevance || 0) >= RELEVANCE_THRESHOLD)
    .sort((a, b) => (b._majorRelevance || 0) - (a._majorRelevance || 0));
}

/**
 * Filter + sort jobs for a target role, attaching _relevance to each result.
 * Pass role = null to disable filtering (returns jobs unchanged).
 */
export function filterJobsForRole(jobs, role, major) {
  if (!role || !Array.isArray(jobs)) return jobs;
  return jobs
    .map((j) => ({ ...j, _relevance: scoreJobForRole(j, role, major) }))
    .filter((j) => j._relevance >= RELEVANCE_THRESHOLD)
    .sort((a, b) => b._relevance - a._relevance);
}

// ── DIAGNOSTIC HELPERS (exported for admin / debugging) ──────────────────────

export function explainScore(job, role, major) {
  const score = scoreJobForRole(job, role, major);
  const { includes, excludes, skills, family } = buildScoringRules(role);
  const title = (job.title || "").toLowerCase();
  return {
    score,
    family,
    matched_includes: includes.filter((k) => title.includes(k)),
    matched_excludes: excludes.filter((k) => title.includes(k)),
    matched_skills: skills.filter((s) =>
      (job.description || "").toLowerCase().includes(s) ||
      (job.tech_stack || []).map((t) => t.toLowerCase()).includes(s)
    ),
    threshold: RELEVANCE_THRESHOLD,
    show: score >= RELEVANCE_THRESHOLD,
  };
}

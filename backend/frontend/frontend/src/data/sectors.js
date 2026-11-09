/**
 * Sector taxonomy — 100+ sectors organized into 14 top-level categories.
 *
 * Each sector has:
 *   - id:           kebab-case unique slug
 *   - label:        UI display name
 *   - emoji:        small visual indicator
 *   - category:     top-level grouping
 *   - dbIndustry:   maps to one of the 15 industries in backend/jobs.py INDUSTRY_MAP
 *                   (so we can filter the existing DB by industry= server-side)
 *   - keywords:     additional keywords appended to the search query when this
 *                   sector is selected (for narrower targeting beyond the bucket)
 */

export const SECTOR_CATEGORIES = [
  { id: "technology",   label: "Technology",          emoji: "💻" },
  { id: "engineering",  label: "Engineering",         emoji: "🔧" },
  { id: "healthcare",   label: "Healthcare & Life Sciences", emoji: "🩺" },
  { id: "finance",      label: "Finance",             emoji: "💰" },
  { id: "business",     label: "Business & Consulting", emoji: "📊" },
  { id: "marketing",    label: "Marketing & Comms",   emoji: "📣" },
  { id: "sales",        label: "Sales & Customer",    emoji: "🤝" },
  { id: "design",       label: "Design & Creative",   emoji: "🎨" },
  { id: "education",    label: "Education",           emoji: "📚" },
  { id: "legal",        label: "Legal",               emoji: "⚖️" },
  { id: "media",        label: "Media & Publishing",  emoji: "🎬" },
  { id: "public",       label: "Public Sector & Impact", emoji: "🏛️" },
  { id: "hospitality",  label: "Hospitality & Retail", emoji: "🏨" },
  { id: "emerging",     label: "Emerging & Frontier", emoji: "🚀" },
];

export const SECTORS = [
  // ── Technology (15) ──────────────────────────────────────────────────────
  { id: "software-engineering",    label: "Software Engineering",       emoji: "⚡", category: "technology",  dbIndustry: "Technology", keywords: ["software engineer", "developer"] },
  { id: "ai-ml",                   label: "AI / Machine Learning",      emoji: "🧠", category: "technology",  dbIndustry: "Technology", keywords: ["machine learning engineer", "ai engineer"] },
  { id: "data-science",            label: "Data Science & Analytics",   emoji: "📈", category: "technology",  dbIndustry: "Technology", keywords: ["data scientist", "data analyst"] },
  { id: "cybersecurity",           label: "Cybersecurity",              emoji: "🛡️", category: "technology",  dbIndustry: "Technology", keywords: ["cybersecurity", "security engineer"] },
  { id: "cloud-devops",            label: "Cloud & DevOps",             emoji: "☁️", category: "technology",  dbIndustry: "Technology", keywords: ["devops", "cloud engineer", "site reliability"] },
  { id: "mobile-dev",              label: "Mobile Development",         emoji: "📱", category: "technology",  dbIndustry: "Technology", keywords: ["ios developer", "android developer", "mobile"] },
  { id: "frontend",                label: "Frontend Engineering",       emoji: "🎨", category: "technology",  dbIndustry: "Technology", keywords: ["frontend developer", "react engineer"] },
  { id: "backend",                 label: "Backend Engineering",        emoji: "⚙️", category: "technology",  dbIndustry: "Technology", keywords: ["backend developer", "api engineer"] },
  { id: "full-stack",              label: "Full-Stack Engineering",     emoji: "🧱", category: "technology",  dbIndustry: "Technology", keywords: ["full stack developer"] },
  { id: "platform-sre",            label: "Platform & SRE",             emoji: "🏗️", category: "technology",  dbIndustry: "Technology", keywords: ["platform engineer", "site reliability"] },
  { id: "data-engineering",        label: "Data Engineering",           emoji: "🗄️", category: "technology",  dbIndustry: "Technology", keywords: ["data engineer", "etl"] },
  { id: "blockchain-web3",         label: "Blockchain & Web3",          emoji: "🔗", category: "technology",  dbIndustry: "Technology", keywords: ["blockchain", "smart contract", "solidity"] },
  { id: "game-dev",                label: "Game Development",           emoji: "🎮", category: "technology",  dbIndustry: "Technology", keywords: ["game developer", "unity", "unreal"] },
  { id: "qa-testing",              label: "QA & Test Engineering",      emoji: "🧪", category: "technology",  dbIndustry: "Technology", keywords: ["qa engineer", "test automation"] },
  { id: "embedded-iot",            label: "Embedded & IoT",             emoji: "📡", category: "technology",  dbIndustry: "Technology", keywords: ["embedded systems", "firmware", "iot"] },

  // ── Engineering (10) ─────────────────────────────────────────────────────
  { id: "mechanical-eng",          label: "Mechanical Engineering",     emoji: "⚙️", category: "engineering", dbIndustry: "Engineering", keywords: ["mechanical engineer"] },
  { id: "electrical-eng",          label: "Electrical Engineering",     emoji: "⚡", category: "engineering", dbIndustry: "Engineering", keywords: ["electrical engineer"] },
  { id: "civil-eng",               label: "Civil Engineering",          emoji: "🏗️", category: "engineering", dbIndustry: "Engineering", keywords: ["civil engineer", "structural engineer"] },
  { id: "chemical-eng",            label: "Chemical Engineering",       emoji: "🧪", category: "engineering", dbIndustry: "Engineering", keywords: ["chemical engineer"] },
  { id: "aerospace-eng",           label: "Aerospace Engineering",      emoji: "✈️", category: "engineering", dbIndustry: "Engineering", keywords: ["aerospace engineer"] },
  { id: "industrial-eng",          label: "Industrial Engineering",     emoji: "🏭", category: "engineering", dbIndustry: "Engineering", keywords: ["industrial engineer"] },
  { id: "manufacturing",           label: "Manufacturing & Production", emoji: "🏭", category: "engineering", dbIndustry: "Engineering", keywords: ["manufacturing engineer", "production"] },
  { id: "biomedical-eng",          label: "Biomedical Engineering",     emoji: "🧬", category: "engineering", dbIndustry: "Engineering", keywords: ["biomedical engineer"] },
  { id: "robotics",                label: "Robotics",                   emoji: "🤖", category: "engineering", dbIndustry: "Engineering", keywords: ["robotics engineer"] },
  { id: "automotive-eng",          label: "Automotive Engineering",     emoji: "🚗", category: "engineering", dbIndustry: "Engineering", keywords: ["automotive engineer"] },

  // ── Healthcare & Life Sciences (12) ─────────────────────────────────────
  { id: "nursing",                 label: "Nursing",                    emoji: "💊", category: "healthcare",  dbIndustry: "Healthcare", keywords: ["registered nurse", "nurse practitioner"] },
  { id: "physicians",              label: "Physicians & Surgeons",      emoji: "🩺", category: "healthcare",  dbIndustry: "Healthcare", keywords: ["physician", "surgeon"] },
  { id: "pharmacy",                label: "Pharmacy",                   emoji: "💊", category: "healthcare",  dbIndustry: "Healthcare", keywords: ["pharmacist"] },
  { id: "dental",                  label: "Dental",                     emoji: "🦷", category: "healthcare",  dbIndustry: "Healthcare", keywords: ["dental hygienist", "dentist"] },
  { id: "mental-health",           label: "Mental Health & Therapy",    emoji: "🧠", category: "healthcare",  dbIndustry: "Healthcare", keywords: ["therapist", "clinical psychologist"] },
  { id: "medical-tech",            label: "Medical Tech & Radiology",   emoji: "🩻", category: "healthcare",  dbIndustry: "Healthcare", keywords: ["radiologic technologist", "medical technologist"] },
  { id: "healthcare-admin",        label: "Healthcare Administration",  emoji: "🏥", category: "healthcare",  dbIndustry: "Healthcare", keywords: ["healthcare administrator"] },
  { id: "public-health",           label: "Public Health",              emoji: "🌍", category: "healthcare",  dbIndustry: "Healthcare", keywords: ["public health analyst", "epidemiologist"] },
  { id: "clinical-research",       label: "Clinical Research",          emoji: "🧪", category: "healthcare",  dbIndustry: "Research & Science", keywords: ["clinical research coordinator"] },
  { id: "biotech",                 label: "Biotechnology",              emoji: "🧬", category: "healthcare",  dbIndustry: "Research & Science", keywords: ["biotechnology", "bioinformatics"] },
  { id: "pharmaceuticals",         label: "Pharmaceuticals",            emoji: "💉", category: "healthcare",  dbIndustry: "Healthcare", keywords: ["pharmaceutical", "drug development"] },
  { id: "physical-therapy",        label: "Physical & Occupational Therapy", emoji: "🦵", category: "healthcare", dbIndustry: "Healthcare", keywords: ["physical therapist", "occupational therapist"] },

  // ── Finance (10) ────────────────────────────────────────────────────────
  { id: "investment-banking",      label: "Investment Banking",         emoji: "💼", category: "finance",     dbIndustry: "Finance", keywords: ["investment banker"] },
  { id: "financial-analysis",      label: "Financial Analysis",         emoji: "📊", category: "finance",     dbIndustry: "Finance", keywords: ["financial analyst"] },
  { id: "accounting",              label: "Accounting & Audit",         emoji: "🧾", category: "finance",     dbIndustry: "Finance", keywords: ["accountant", "auditor", "cpa"] },
  { id: "wealth-mgmt",             label: "Wealth Management",          emoji: "📈", category: "finance",     dbIndustry: "Finance", keywords: ["financial advisor", "wealth manager"] },
  { id: "insurance",               label: "Insurance & Actuarial",      emoji: "🛡️", category: "finance",     dbIndustry: "Finance", keywords: ["actuary", "insurance underwriter"] },
  { id: "fintech",                 label: "FinTech",                    emoji: "💳", category: "finance",     dbIndustry: "Finance", keywords: ["fintech", "payments engineer"] },
  { id: "quant-finance",           label: "Quantitative Finance",       emoji: "📐", category: "finance",     dbIndustry: "Finance", keywords: ["quantitative analyst", "quant trader"] },
  { id: "tax-compliance",          label: "Tax & Compliance",           emoji: "📋", category: "finance",     dbIndustry: "Finance", keywords: ["tax specialist", "compliance officer"] },
  { id: "corporate-finance",       label: "Corporate Finance",          emoji: "🏢", category: "finance",     dbIndustry: "Finance", keywords: ["corporate finance", "fp&a"] },
  { id: "real-estate-finance",     label: "Real Estate & Mortgage",     emoji: "🏘️", category: "finance",     dbIndustry: "Finance", keywords: ["mortgage", "real estate analyst"] },

  // ── Business & Consulting (8) ───────────────────────────────────────────
  { id: "management-consulting",   label: "Management Consulting",      emoji: "🧠", category: "business",    dbIndustry: "Business", keywords: ["management consultant"] },
  { id: "strategy-ops",            label: "Strategy & Operations",      emoji: "🎯", category: "business",    dbIndustry: "Business", keywords: ["strategy analyst", "operations manager"] },
  { id: "product-management",      label: "Product Management",         emoji: "🚀", category: "business",    dbIndustry: "Technology", keywords: ["product manager"] },
  { id: "project-mgmt",            label: "Project & Program Mgmt",     emoji: "📋", category: "business",    dbIndustry: "Business", keywords: ["project manager", "program manager"] },
  { id: "business-analysis",       label: "Business Analysis",          emoji: "📈", category: "business",    dbIndustry: "Business", keywords: ["business analyst"] },
  { id: "supply-chain-mgmt",       label: "Operations & Supply Chain",  emoji: "📦", category: "business",    dbIndustry: "Supply Chain", keywords: ["supply chain", "logistics"] },
  { id: "executive",               label: "Executive / C-Suite",        emoji: "👔", category: "business",    dbIndustry: "Business", keywords: ["chief", "director", "vice president"] },
  { id: "chief-of-staff",          label: "Chief of Staff & EA",        emoji: "📎", category: "business",    dbIndustry: "Business", keywords: ["chief of staff", "executive assistant"] },

  // ── Marketing & Comms (8) ───────────────────────────────────────────────
  { id: "digital-marketing",       label: "Digital Marketing",          emoji: "📲", category: "marketing",   dbIndustry: "Marketing", keywords: ["digital marketing"] },
  { id: "brand-strategy",          label: "Brand & Creative Strategy",  emoji: "✨", category: "marketing",   dbIndustry: "Marketing", keywords: ["brand strategist", "brand manager"] },
  { id: "content-copy",            label: "Content & Copywriting",      emoji: "✍️", category: "marketing",   dbIndustry: "Marketing", keywords: ["content writer", "copywriter"] },
  { id: "seo-sem",                 label: "SEO & SEM",                  emoji: "🔍", category: "marketing",   dbIndustry: "Marketing", keywords: ["seo specialist", "sem specialist"] },
  { id: "social-media",            label: "Social Media",               emoji: "📱", category: "marketing",   dbIndustry: "Marketing", keywords: ["social media manager"] },
  { id: "public-relations",        label: "Public Relations",           emoji: "📰", category: "marketing",   dbIndustry: "Marketing", keywords: ["public relations"] },
  { id: "growth-performance",      label: "Growth & Performance",       emoji: "📈", category: "marketing",   dbIndustry: "Marketing", keywords: ["growth marketer", "performance marketing"] },
  { id: "marketing-analytics",     label: "Marketing Analytics",        emoji: "📊", category: "marketing",   dbIndustry: "Marketing", keywords: ["marketing analyst", "marketing analytics"] },

  // ── Sales & Customer (6) ────────────────────────────────────────────────
  { id: "account-executive",       label: "Account Executive",          emoji: "🤝", category: "sales",       dbIndustry: "Sales", keywords: ["account executive"] },
  { id: "sdr-bdr",                 label: "SDR / BDR / Inside Sales",   emoji: "📞", category: "sales",       dbIndustry: "Sales", keywords: ["sdr", "bdr", "inside sales"] },
  { id: "customer-success",        label: "Customer Success",           emoji: "💚", category: "sales",       dbIndustry: "Sales", keywords: ["customer success"] },
  { id: "sales-engineering",       label: "Sales Engineering",          emoji: "🛠️", category: "sales",       dbIndustry: "Sales", keywords: ["sales engineer", "solutions engineer"] },
  { id: "revenue-ops",             label: "Revenue Operations",         emoji: "📊", category: "sales",       dbIndustry: "Sales", keywords: ["revenue operations", "rev ops"] },
  { id: "business-dev",            label: "Business Development",       emoji: "🌐", category: "sales",       dbIndustry: "Sales", keywords: ["business development"] },

  // ── Design & Creative (8) ───────────────────────────────────────────────
  { id: "ux-product-design",       label: "UX / Product Design",        emoji: "🎯", category: "design",      dbIndustry: "Design & Creative", keywords: ["ux designer", "product designer"] },
  { id: "ui-visual",               label: "UI & Visual Design",         emoji: "🖼️", category: "design",      dbIndustry: "Design & Creative", keywords: ["ui designer", "visual designer"] },
  { id: "graphic-design",          label: "Graphic Design",             emoji: "🎨", category: "design",      dbIndustry: "Design & Creative", keywords: ["graphic designer"] },
  { id: "motion-animation",        label: "Motion & Animation",         emoji: "🎞️", category: "design",      dbIndustry: "Design & Creative", keywords: ["motion graphics", "animator"] },
  { id: "industrial-design",       label: "Industrial Design",          emoji: "🪑", category: "design",      dbIndustry: "Design & Creative", keywords: ["industrial designer"] },
  { id: "photo-video",             label: "Photography & Video",        emoji: "📷", category: "design",      dbIndustry: "Design & Creative", keywords: ["photographer", "video editor"] },
  { id: "creative-direction",      label: "Creative Direction",         emoji: "🌟", category: "design",      dbIndustry: "Design & Creative", keywords: ["creative director", "art director"] },
  { id: "ux-research",             label: "UX Research",                emoji: "🔬", category: "design",      dbIndustry: "Design & Creative", keywords: ["ux research", "user research"] },

  // ── Education (5) ───────────────────────────────────────────────────────
  { id: "k12-teaching",            label: "K-12 Teaching",              emoji: "🍎", category: "education",   dbIndustry: "Education", keywords: ["teacher", "elementary teacher"] },
  { id: "higher-ed",               label: "Higher Education",           emoji: "🎓", category: "education",   dbIndustry: "Education", keywords: ["professor", "academic advisor"] },
  { id: "edtech",                  label: "EdTech",                     emoji: "💡", category: "education",   dbIndustry: "Technology", keywords: ["edtech", "learning engineer"] },
  { id: "ed-admin",                label: "Educational Administration", emoji: "🏫", category: "education",   dbIndustry: "Education", keywords: ["principal", "education administrator"] },
  { id: "tutoring",                label: "Tutoring & Coaching",        emoji: "📝", category: "education",   dbIndustry: "Education", keywords: ["tutor", "instructor"] },

  // ── Legal (5) ───────────────────────────────────────────────────────────
  { id: "corporate-law",           label: "Corporate Law",              emoji: "⚖️", category: "legal",       dbIndustry: "Legal", keywords: ["corporate counsel", "attorney"] },
  { id: "litigation",              label: "Litigation",                 emoji: "📜", category: "legal",       dbIndustry: "Legal", keywords: ["litigation", "trial attorney"] },
  { id: "compliance",              label: "Compliance & Regulatory",    emoji: "🛡️", category: "legal",       dbIndustry: "Legal", keywords: ["compliance officer"] },
  { id: "ip-law",                  label: "Intellectual Property",      emoji: "💡", category: "legal",       dbIndustry: "Legal", keywords: ["ip attorney", "patent"] },
  { id: "paralegal",               label: "Paralegal & Legal Support",  emoji: "📋", category: "legal",       dbIndustry: "Legal", keywords: ["paralegal", "legal assistant"] },

  // ── Media & Publishing (5) ──────────────────────────────────────────────
  { id: "journalism",              label: "Journalism",                 emoji: "📰", category: "media",       dbIndustry: "Marketing", keywords: ["journalist", "reporter"] },
  { id: "broadcasting",            label: "Broadcasting & Film",        emoji: "🎬", category: "media",       dbIndustry: "Design & Creative", keywords: ["broadcasting", "producer"] },
  { id: "publishing",              label: "Publishing & Editorial",     emoji: "📚", category: "media",       dbIndustry: "Marketing", keywords: ["editor", "publisher"] },
  { id: "music-audio",             label: "Music & Audio",              emoji: "🎵", category: "media",       dbIndustry: "Design & Creative", keywords: ["audio engineer", "music producer"] },
  { id: "content-production",      label: "Content Production",         emoji: "📹", category: "media",       dbIndustry: "Marketing", keywords: ["content producer", "videographer"] },

  // ── Public Sector & Impact (5) ──────────────────────────────────────────
  { id: "government",              label: "Government & Civil Service", emoji: "🏛️", category: "public",      dbIndustry: "Government", keywords: ["government", "civil service"] },
  { id: "nonprofit",               label: "Nonprofit & NGO",            emoji: "💚", category: "public",      dbIndustry: "Government", keywords: ["nonprofit", "ngo"] },
  { id: "policy",                  label: "Policy & Public Admin",      emoji: "📋", category: "public",      dbIndustry: "Government", keywords: ["policy analyst", "public administration"] },
  { id: "social-work",             label: "Social Work",                emoji: "🤲", category: "public",      dbIndustry: "Government", keywords: ["social worker"] },
  { id: "international",           label: "International Relations",    emoji: "🌍", category: "public",      dbIndustry: "Government", keywords: ["foreign service", "international affairs"] },

  // ── Hospitality, Retail & Service (5) ───────────────────────────────────
  { id: "hospitality-mgmt",        label: "Hospitality Management",     emoji: "🏨", category: "hospitality", dbIndustry: "Retail & Hospitality", keywords: ["hotel manager", "hospitality"] },
  { id: "restaurant-culinary",     label: "Restaurant & Culinary",      emoji: "🍳", category: "hospitality", dbIndustry: "Retail & Hospitality", keywords: ["restaurant manager", "chef"] },
  { id: "retail-mgmt",             label: "Retail Management",          emoji: "🛍️", category: "hospitality", dbIndustry: "Retail & Hospitality", keywords: ["retail manager"] },
  { id: "event-planning",          label: "Event Planning",             emoji: "🎉", category: "hospitality", dbIndustry: "Retail & Hospitality", keywords: ["event coordinator", "event planner"] },
  { id: "travel-tourism",          label: "Travel & Tourism",           emoji: "✈️", category: "hospitality", dbIndustry: "Retail & Hospitality", keywords: ["travel", "tourism"] },

  // ── Emerging & Frontier (6) ─────────────────────────────────────────────
  { id: "sustainability",          label: "Sustainability & Climate",   emoji: "🌱", category: "emerging",    dbIndustry: "Research & Science", keywords: ["sustainability", "climate", "esg"] },
  { id: "space",                   label: "Space & Astronautics",       emoji: "🚀", category: "emerging",    dbIndustry: "Engineering", keywords: ["space engineer", "astronautics"] },
  { id: "defense",                 label: "Defense & National Security", emoji: "🛡️", category: "emerging",   dbIndustry: "Government", keywords: ["defense", "national security"] },
  { id: "agriculture",             label: "Agriculture & AgriTech",     emoji: "🌾", category: "emerging",    dbIndustry: "Research & Science", keywords: ["agriculture", "agritech"] },
  { id: "renewable-energy",        label: "Renewable Energy",           emoji: "⚡", category: "emerging",    dbIndustry: "Engineering", keywords: ["renewable energy", "solar engineer"] },
  { id: "quantum-computing",       label: "Quantum Computing",          emoji: "⚛️", category: "emerging",    dbIndustry: "Technology", keywords: ["quantum computing", "quantum engineer"] },

  // ── Human Resources (4) ─────────────────────────────────────────────────
  { id: "talent-acquisition",      label: "Talent Acquisition",         emoji: "👥", category: "business",    dbIndustry: "Human Resources", keywords: ["recruiter", "talent acquisition"] },
  { id: "hr-business-partner",     label: "HR Business Partner",        emoji: "🤝", category: "business",    dbIndustry: "Human Resources", keywords: ["hr business partner", "hrbp"] },
  { id: "compensation",            label: "Compensation & Benefits",    emoji: "💵", category: "business",    dbIndustry: "Human Resources", keywords: ["compensation analyst", "benefits"] },
  { id: "people-ops",              label: "People Operations",          emoji: "👤", category: "business",    dbIndustry: "Human Resources", keywords: ["people operations"] },
];

// helper exports
export const SECTORS_BY_CATEGORY = SECTOR_CATEGORIES.reduce((acc, cat) => {
  acc[cat.id] = SECTORS.filter(s => s.category === cat.id);
  return acc;
}, {});

export const SECTOR_BY_ID = SECTORS.reduce((acc, s) => {
  acc[s.id] = s;
  return acc;
}, {});

// Trending sectors — manually curated for now; later derive from hiring velocity data
export const TRENDING_SECTORS = [
  "ai-ml",
  "cybersecurity",
  "data-engineering",
  "product-management",
  "sustainability",
  "quantum-computing",
];

// New-grad-friendly sectors — broader entry points
export const NEW_GRAD_SECTORS = [
  "software-engineering",
  "data-science",
  "frontend",
  "backend",
  "financial-analysis",
  "accounting",
  "k12-teaching",
  "ux-product-design",
  "digital-marketing",
  "sdr-bdr",
];

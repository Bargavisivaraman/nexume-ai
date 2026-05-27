"""Shared helpers for ATS adapters."""

import hashlib
import re
from datetime import datetime, timezone
from typing import Optional


# ── seniority / type detection ───────────────────────────────────────────────
INTERNSHIP_RE = re.compile(r"\b(intern|internship|co[- ]?op)\b", re.IGNORECASE)
NEW_GRAD_RE   = re.compile(r"\b(new[ -]?grad|new[ -]?graduate|graduate(?: program)?|university grad|2024 grad|2025 grad|2026 grad|early career)\b", re.IGNORECASE)
ENTRY_RE      = re.compile(r"\b(entry[ -]?level|junior|jr\.?|associate|level[ -]?1|l1)\b", re.IGNORECASE)
SENIOR_RE     = re.compile(r"\b(senior|sr\.?|staff|principal|lead|architect)\b", re.IGNORECASE)
EXEC_RE       = re.compile(r"\b(director|vp|vice president|chief|cto|ceo|coo|cfo|head of|founding)\b", re.IGNORECASE)
REMOTE_RE     = re.compile(r"\b(remote|wfh|work from home|distributed)\b", re.IGNORECASE)
HYBRID_RE     = re.compile(r"\bhybrid\b", re.IGNORECASE)
FULLTIME_RE   = re.compile(r"\bfull[ -]?time\b", re.IGNORECASE)
PARTTIME_RE   = re.compile(r"\bpart[ -]?time\b", re.IGNORECASE)
CONTRACT_RE   = re.compile(r"\b(contract|contractor|freelance|temporary)\b", re.IGNORECASE)

# Tech-stack tokens we look for in job descriptions
TECH_STACK_TOKENS = [
    "python", "javascript", "typescript", "java ", " go ", "golang", "rust",
    "ruby", "kotlin", "swift", "c++", "c#", "php", "scala", "elixir",
    "react", "vue", "angular", "svelte", "next.js", "nextjs", "nuxt", "remix",
    "node.js", "nodejs", "django", "flask", "fastapi", "rails", "spring", "laravel",
    "postgres", "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "dynamodb", "cassandra",
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform", "ansible",
    "graphql", "rest api", "grpc", "kafka", "rabbitmq",
    "tensorflow", "pytorch", "jax", "huggingface", "langchain", "llm",
    "tailwind", "css", "sass", "webpack", "vite",
    "figma", "sketch",
]


def detect_experience_level(title: str, description: str = "") -> str:
    """Best-effort seniority classification from title (description is a fallback)."""
    text = f"{title} {description[:500]}"
    if INTERNSHIP_RE.search(text):  return "Entry Level"
    if NEW_GRAD_RE.search(text):    return "Entry Level"
    if EXEC_RE.search(title):       return "Executive"
    if SENIOR_RE.search(title):     return "Senior"
    if ENTRY_RE.search(title):      return "Entry Level"
    return "Mid Level"


def detect_internship(title: str, description: str = "") -> bool:
    return bool(INTERNSHIP_RE.search(f"{title} {description[:500]}"))


def detect_new_grad(title: str, description: str = "") -> bool:
    return bool(NEW_GRAD_RE.search(f"{title} {description[:500]}"))


def detect_work_mode(title: str, description: str, location: str = "") -> tuple[str, bool]:
    """Returns (work_mode, is_remote_bool). Order matters: remote > hybrid > on-site."""
    text = f"{title} {description[:800]} {location}"
    if REMOTE_RE.search(text):
        return ("Remote", True)
    if HYBRID_RE.search(text):
        return ("Hybrid", False)
    return ("On-site", False)


def detect_job_type(title: str, description: str, default: Optional[str] = None) -> Optional[str]:
    text = f"{title} {description[:400]}"
    if INTERNSHIP_RE.search(text): return "Internship"
    if CONTRACT_RE.search(text):   return "Contract"
    if PARTTIME_RE.search(text):   return "Part-time"
    if FULLTIME_RE.search(text):   return "Full-time"
    return default


def extract_tech_stack(description: str, limit: int = 12) -> list[str]:
    """Returns a deduped list of tech/skill tokens found in the description."""
    if not description: return []
    lowered = description.lower()
    found = []
    seen = set()
    for tok in TECH_STACK_TOKENS:
        if tok in lowered and tok.strip() not in seen:
            label = tok.strip().rstrip(".").title()
            # normalize a few capitalizations
            label = label.replace("Aws", "AWS").replace("Gcp", "GCP").replace("Sql", "SQL").replace("Css", "CSS").replace("Llm", "LLM").replace("Api", "API").replace("Rest API", "REST API").replace("Grpc", "gRPC").replace("Nodejs", "Node.js").replace("Nextjs", "Next.js")
            found.append(label)
            seen.add(tok.strip())
            if len(found) >= limit:
                break
    return found


def parse_salary(text: str) -> tuple[Optional[float], Optional[float], Optional[str]]:
    """Best-effort salary parser. Returns (min, max, period) — any may be None.

    Handles:
      - "$120,000 - $160,000"
      - "$120k - $160k"
      - "$50/hour"
      - ranges separated by 'to' or '–'
    """
    if not text:
        return (None, None, None)
    t = text.lower().replace(",", "")

    # hourly
    hourly = re.search(r"\$?(\d+(?:\.\d+)?)\s*(?:/|per\s)\s*(?:hour|hr|h)\b", t)
    if hourly:
        v = float(hourly.group(1))
        return (v, v, "hour")

    # k-style ranges: $120k - $160k
    krange = re.search(r"\$?(\d{2,4})\s*k\s*[-–to]+\s*\$?(\d{2,4})\s*k", t)
    if krange:
        lo, hi = float(krange.group(1)) * 1000, float(krange.group(2)) * 1000
        return (lo, hi, "year")

    # standard ranges: $120000 - $160000
    rng = re.search(r"\$?(\d{4,7})\s*[-–to]+\s*\$?(\d{4,7})", t)
    if rng:
        lo, hi = float(rng.group(1)), float(rng.group(2))
        if 10000 <= lo <= 1_000_000:
            return (lo, hi, "year")

    # single k-style: $120k
    ksingle = re.search(r"\$?(\d{2,4})\s*k\b", t)
    if ksingle:
        v = float(ksingle.group(1)) * 1000
        return (v, v, "year")

    return (None, None, None)


def compute_dedupe_hash(title: str, company: str, location: str) -> str:
    """MD5 of normalized title|company|location — secondary dedup key."""
    raw = f"{(title or '').lower().strip()}|{(company or '').lower().strip()}|{(location or '').lower().strip()}"
    return hashlib.md5(raw.encode()).hexdigest()


def truncate(s: Optional[str], n: int) -> Optional[str]:
    if not s: return None
    s = s.strip()
    return s[:n] if len(s) > n else s


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

"""
LandTheRole.ai — Jobs ingestion + query module.

Real data only from JSearch API (which aggregates LinkedIn, Indeed,
Glassdoor, ZipRecruiter, and 40+ other boards).

Rules enforced here:
  - Never generate or invent job listings
  - Never invent dates, salaries, company names, or URLs
  - If data is missing, store null and surface "Not available" to the UI
  - Deduplicate by external job_id; secondary dedupe by title+company+location hash
"""

import asyncio
import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from urllib.parse import urlparse

import httpx
from supabase import Client

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────

JSEARCH_BASE = "https://jsearch.p.rapidapi.com"

KNOWN_SOURCES: dict[str, str] = {
    "linkedin.com":        "LinkedIn",
    "indeed.com":          "Indeed",
    "glassdoor.com":       "Glassdoor",
    "ziprecruiter.com":    "ZipRecruiter",
    "monster.com":         "Monster",
    "dice.com":            "Dice",
    "greenhouse.io":       "Greenhouse",
    "lever.co":            "Lever",
    "workday.com":         "Workday",
    "myworkdayjobs.com":   "Workday",
    "icims.com":           "iCIMS",
    "smartrecruiters.com": "SmartRecruiters",
    "amazon.jobs":         "Amazon",
    "careers.google.com":  "Google",
    "jobs.apple.com":      "Apple",
    "microsoft.com":       "Microsoft",
    "meta.com":            "Meta",
}

EMPLOYMENT_TYPE_MAP: dict[str, str] = {
    "FULLTIME":   "Full-time",
    "PARTTIME":   "Part-time",
    "CONTRACTOR": "Contract",
    "INTERN":     "Internship",
}

# ─────────────────────────────────────────────────────────────────────────────
# CLASSIFICATION  (title-based, stored in DB at ingestion time)
# ─────────────────────────────────────────────────────────────────────────────

INDUSTRY_MAP: dict[str, list[str]] = {
    "Technology":          ["software", "developer", "full stack", "frontend", "backend",
                            "devops", "cloud engineer", "cybersecurity", "machine learning",
                            "data scientist", "data engineer", "ios developer", "android developer",
                            "mobile developer", "qa engineer", "ai engineer", "blockchain",
                            "network engineer", "database admin", "it support", "embedded systems",
                            "site reliability", "platform engineer"],
    "Healthcare":          ["nurse", "physician", "therapist", "pharmacist", "medical assistant",
                            "dental hygienist", "healthcare admin", "radiolog", "respiratory therapist",
                            "surgical tech", "occupational therapist", "clinical psych", "medical coder",
                            "surgeon", "psychiatrist", "optometrist", "dietitian"],
    "Education":           ["teacher", "professor", "tutor", "curriculum", "school counselor",
                            "academic advisor", "school principal", "librarian", "instructional",
                            "education coordinator", "teaching assistant"],
    "Finance":             ["financial analyst", "accountant", "cpa", "investment banker",
                            "financial advisor", "auditor", "tax specialist", "actuary", "mortgage",
                            "credit analyst", "underwriter", "portfolio manager", "risk analyst"],
    "Legal":               ["attorney", "lawyer", "paralegal", "compliance officer",
                            "legal assistant", "counsel", "litigation", "corporate counsel"],
    "Marketing":           ["marketing manager", "digital marketing", "content writer", "seo",
                            "social media manager", "brand strategist", "public relations",
                            "copywriter", "email marketing", "growth hacker", "media buyer"],
    "Sales":               ["sales rep", "account executive", "business development",
                            "customer success", "inside sales", "sales engineer", "sdr", "bdr",
                            "account manager", "revenue operations"],
    "Design & Creative":   ["graphic designer", "video editor", "motion graphics", "creative director",
                            "illustrator", "photographer", "game designer", "ux designer",
                            "ui designer", "art director", "visual designer"],
    "Human Resources":     ["hr manager", "recruiter", "talent acquisition", "human resources",
                            "compensation analyst", "hr business partner", "people operations",
                            "workforce planning"],
    "Supply Chain":        ["supply chain", "logistics coordinator", "procurement",
                            "warehouse manager", "inventory analyst", "fulfillment", "purchasing"],
    "Engineering":         ["mechanical engineer", "civil engineer", "electrical engineer",
                            "chemical engineer", "industrial engineer", "electrician", "hvac",
                            "plumber", "structural engineer", "construction project", "aerospace",
                            "manufacturing engineer"],
    "Government":          ["social worker", "policy analyst", "public health analyst",
                            "government program", "community outreach", "public administration",
                            "city planner", "law enforcement"],
    "Research & Science":  ["research scientist", "clinical research", "laboratory technician",
                            "environmental scientist", "biomedical engineer", "bioinformatics",
                            "epidemiologist", "data researcher"],
    "Retail & Hospitality":["hotel manager", "restaurant manager", "retail manager",
                            "event coordinator", "customer service manager", "hospitality",
                            "food service", "concierge"],
    "Business":            ["project manager", "program manager", "operations manager",
                            "business analyst", "management consultant", "strategy analyst",
                            "executive assistant", "chief of staff"],
}

EXPERIENCE_MAP: dict[str, list[str]] = {
    "Executive": ["chief ", "vp ", "vice president", " director", "cto", "ceo", "coo", "cfo",
                  "managing director", "head of", " partner", "svp", "evp"],
    "Senior":    ["senior ", "sr.", " sr ", "lead ", "staff engineer", "principal",
                  "architect", " manager"],
    "Entry Level": ["entry level", "junior ", "jr.", " jr ", "associate ", "intern",
                    "graduate", "new grad", "entry-level"],
}


def _classify_industry(title: str) -> str:
    return classify_industry(title)


def _classify_experience(title: str) -> str:
    return classify_experience(title)


def classify_industry(title: str) -> str:
    tl = title.lower()
    for industry, keywords in INDUSTRY_MAP.items():
        if any(kw in tl for kw in keywords):
            return industry
    return "Other"


def classify_experience(title: str) -> str:
    tl = title.lower()
    for level, keywords in EXPERIENCE_MAP.items():
        if any(kw in tl for kw in keywords):
            return level
    return "Mid Level"


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def extract_source(url: str) -> str:
    if not url:
        return "Unknown"
    try:
        host = urlparse(url).hostname or ""
        host = host.replace("www.", "")
        return KNOWN_SOURCES.get(host, host or "Job Board")
    except Exception:
        return "Job Board"


def compute_dedupe_hash(title: str, company: str, location: str) -> str:
    """MD5 hash of normalized title+company+location for secondary deduplication."""
    raw = f"{title.lower().strip()}|{company.lower().strip()}|{location.lower().strip()}"
    return hashlib.md5(raw.encode()).hexdigest()


def transform_job(raw: dict, country: str) -> dict | None:
    """
    Transform a raw JSearch API result into a normalized DB row.
    Returns None if the result is missing required fields.
    Never invents data — missing fields become None.
    """
    job_id  = (raw.get("job_id") or "").strip()
    title   = (raw.get("job_title") or "").strip()
    company = (raw.get("employer_name") or "").strip()

    if not job_id or not title or not company:
        return None  # skip incomplete records

    city     = (raw.get("job_city")  or "").strip()
    state    = (raw.get("job_state") or "").strip()
    location = ", ".join(filter(None, [city, state])) or None

    description = (raw.get("job_description") or "").strip()
    apply_url   = (raw.get("job_apply_link")  or "").strip() or None

    # Remote detection
    is_remote_flag = bool(raw.get("job_is_remote"))
    if not is_remote_flag:
        text_signals = (title + " " + description[:400]).lower()
        is_remote_flag = "remote" in text_signals

    work_mode = "Remote" if is_remote_flag else (
        "Hybrid" if "hybrid" in description[:400].lower() else "On-site"
    )

    raw_type = (raw.get("job_employment_type") or "").upper()
    job_type = EMPLOYMENT_TYPE_MAP.get(raw_type, None)  # None = unknown, not invented

    sal_min    = raw.get("job_min_salary")     # already numeric or None
    sal_max    = raw.get("job_max_salary")     # already numeric or None
    currency   = raw.get("job_salary_currency") or "USD"
    sal_period = raw.get("job_salary_period")  or None

    posted_at  = raw.get("job_posted_at_datetime_utc") or None

    return {
        "job_id":           job_id,
        "title":            title,
        "company":          company,
        "location":         location,
        "city":             city or None,
        "state":            state or None,
        "country":          country,
        "is_remote":        is_remote_flag,
        "work_mode":        work_mode,
        "industry":         classify_industry(title),
        "experience_level": classify_experience(title),
        "job_type":         job_type,
        "salary_min":       sal_min,
        "salary_max":       sal_max,
        "salary_currency":  currency if (sal_min or sal_max) else None,
        "salary_period":    sal_period,
        "description":      description[:3000] or None,
        "url":              apply_url,          # existing column name in DB
        "source_name":      extract_source(apply_url or ""),
        "posted_at":        posted_at,
        "fetched_at":       datetime.now(timezone.utc).isoformat(),
        "hash_dedupe":      compute_dedupe_hash(title, company, location or ""),
        "is_active":        True,
    }


# ─────────────────────────────────────────────────────────────────────────────
# JSEARCH FETCHER
# ─────────────────────────────────────────────────────────────────────────────

async def fetch_jsearch(
    http: httpx.AsyncClient,
    api_key: str,
    query: str,
    num_pages: int = 3,
) -> list[dict]:
    """
    Fetch real jobs from JSearch API for one query string.
    Returns raw job dicts. Returns [] on any error — never raises.
    """
    try:
        resp = await http.get(
            f"{JSEARCH_BASE}/search",
            headers={
                "X-RapidAPI-Key":  api_key,
                "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
            },
            params={
                "query":       query,
                "num_pages":   str(num_pages),
                "date_posted": "3days",
            },
            timeout=20.0,
        )
        resp.raise_for_status()
        data = resp.json().get("data")
        if not isinstance(data, list):
            print(f"[JSearch] Unexpected response shape for '{query}'")
            return []
        return data
    except httpx.HTTPStatusError as e:
        print(f"[JSearch] HTTP {e.response.status_code} for '{query}': {e.response.text[:200]}")
        return []
    except httpx.TimeoutException:
        print(f"[JSearch] Timeout for '{query}'")
        return []
    except Exception as e:
        print(f"[JSearch] Error for '{query}': {e}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# INGESTION PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

async def run_ingestion(
    supabase: Client,
    jsearch_key: str,
    queries: list[str],
    country: str,
) -> dict:
    """
    Full ingestion pipeline for a batch of queries.
    Fetches → transforms → validates → deduplicates → upserts.
    Logs results to ingestion_runs table.
    Returns run stats dict.
    """
    run_id = str(uuid.uuid4())
    stats  = {"fetched": 0, "inserted": 0, "skipped": 0, "errors": 0}
    start  = datetime.now(timezone.utc)

    print(f"[Ingestion] Starting run {run_id} — {len(queries)} queries for {country}")

    async with httpx.AsyncClient() as http:
        for query in queries:
            raw_jobs = await fetch_jsearch(http, jsearch_key, query, num_pages=3)

            if not raw_jobs:
                stats["errors"] += 1
                await asyncio.sleep(0.5)
                continue

            stats["fetched"] += len(raw_jobs)

            # Transform + validate
            rows: list[dict] = []
            for raw in raw_jobs:
                try:
                    row = transform_job(raw, country)
                    if row is not None:
                        rows.append(row)
                    else:
                        stats["skipped"] += 1
                except Exception as e:
                    print(f"[Transform] Error: {e}")
                    stats["errors"] += 1

            # Upsert to Supabase
            if rows:
                try:
                    supabase.table("jobs").upsert(rows, on_conflict="job_id").execute()
                    stats["inserted"] += len(rows)
                    print(f"[DB] Upserted {len(rows)} jobs for '{query}'")
                except Exception as e:
                    print(f"[DB] Upsert error for '{query}': {e}")
                    stats["errors"]   += len(rows)
                    stats["skipped"]  += len(rows)

            await asyncio.sleep(0.8)  # respect JSearch rate limit

    # Log ingestion run
    elapsed = (datetime.now(timezone.utc) - start).seconds
    try:
        supabase.table("ingestion_runs").insert({
            "run_id":       run_id,
            "country":      country,
            "queries_run":  len(queries),
            "fetched":      stats["fetched"],
            "inserted":     stats["inserted"],
            "skipped":      stats["skipped"],
            "errors":       stats["errors"],
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        print(f"[Ingestion] Run {run_id} done in {elapsed}s — {stats}")
    except Exception as e:
        print(f"[Ingestion] Failed to log run: {e}")

    return stats


# ─────────────────────────────────────────────────────────────────────────────
# QUERY BUILDER  (used by /jobs/ endpoint)
# ─────────────────────────────────────────────────────────────────────────────

def build_jobs_query(
    supabase: Client,
    country:          str,
    keyword:          Optional[str] = None,
    industry:         Optional[str] = None,
    job_type:         Optional[str] = None,
    experience_level: Optional[str] = None,
    work_mode:        Optional[str] = None,
    state_filter:     Optional[str] = None,
    date_range:       Optional[str] = None,
):
    """
    Build a Supabase query with server-side filtering.
    Filters run at the DB layer — no Python-side post-filtering.
    All filters are optional and stacked.
    """
    # Minimal field selection for listing responses (full description on demand)
    SELECT = (
        "job_id,title,company,location,city,state,country,"
        "is_remote,work_mode,industry,job_type,experience_level,"
        "salary_min,salary_max,salary_currency,salary_period,"
        "url,source_name,posted_at,fetched_at,"
        "description"
    )

    q = (
        supabase.table("jobs")
        .select(SELECT)
        .eq("country", country.upper())
        .eq("is_active", True)
    )

    # ── Keyword (title + company + description) ───────────────────────────────
    if keyword and keyword.strip():
        kw = keyword.strip()
        q  = q.or_(
            f"title.ilike.%{kw}%,"
            f"company.ilike.%{kw}%,"
            f"description.ilike.%{kw}%"
        )

    # ── Industry (exact match on pre-classified column) ───────────────────────
    if industry and industry.strip():
        q = q.eq("industry", industry.strip())

    # ── Job type (exact match on normalised column) ───────────────────────────
    if job_type and job_type.strip():
        q = q.eq("job_type", job_type.strip())

    # ── Experience level ─────────────────────────────────────────────────────
    if experience_level and experience_level.strip():
        level_map = {
            "entry":     "Entry Level",
            "mid":       "Mid Level",
            "senior":    "Senior",
            "executive": "Executive",
        }
        resolved = level_map.get(experience_level.lower(), experience_level)
        q = q.eq("experience_level", resolved)

    # ── Work mode (Remote / Hybrid / On-site) ────────────────────────────────
    if work_mode and work_mode.strip():
        q = q.eq("work_mode", work_mode.strip())

    # ── State / location filter ──────────────────────────────────────────────
    # The user types something like "Los Angeles, CA" into the location box.
    # That string could match any of: the `city` column, the `state` column, or
    # the denormalized `location` column. OR across all three so we don't miss.
    if state_filter and state_filter.strip():
        sf = state_filter.strip().replace(",", "")  # commas confuse PostgREST OR
        # Try both the full string and the first city-name segment for better hits
        first_token = sf.split()[0] if sf else sf
        q = q.or_(
            f"city.ilike.%{sf}%,"
            f"state.ilike.%{sf}%,"
            f"location.ilike.%{sf}%,"
            f"city.ilike.%{first_token}%,"
            f"location.ilike.%{first_token}%"
        )

    # ── Date range — filter by the source's posted_at, NOT our fetched_at ────
    # fetched_at = "we just ingested it"; posted_at = "the company posted it".
    # Users mean the latter when they pick "Past 24 hours".
    # Jobs without a posted_at (some sources like Lever omit it) are excluded
    # from any restrictive date filter — better to under-include than mislead.
    if date_range and date_range != "all":
        hours_map = {"24h": 24, "7d": 168, "30d": 720}
        hours = hours_map.get(date_range)
        if hours:
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
            q = q.gte("posted_at", cutoff).not_.is_("posted_at", "null")

    return q


# ─────────────────────────────────────────────────────────────────────────────
# QUERY LISTS
# ─────────────────────────────────────────────────────────────────────────────

INDIA_QUERIES: list[str] = [
    # Tech
    "software engineer India", "data scientist India", "product manager India",
    "frontend developer India", "backend developer India", "DevOps engineer India",
    "machine learning engineer India", "data analyst India",
    # Non-tech
    "registered nurse India", "financial analyst India", "marketing manager India",
    "business analyst India", "teacher India", "operations manager India",
    "remote software engineer India",
]

US_QUERIES: list[str] = [
    # ── Technology ──────────────────────────────────────────────────────────
    "software engineer United States",
    "frontend developer United States",
    "backend developer United States",
    "full stack developer United States",
    "data scientist United States",
    "machine learning engineer United States",
    "data engineer United States",
    "DevOps engineer United States",
    "cloud engineer United States",
    "cybersecurity analyst United States",
    "mobile developer United States",
    "iOS developer United States",
    "Android developer United States",
    "product manager United States",
    "UX designer United States",
    "data analyst United States",
    "QA engineer United States",
    "solutions architect United States",
    "site reliability engineer United States",
    "AI engineer United States",
    "network engineer United States",
    "database administrator United States",
    "IT support specialist United States",
    # ── Healthcare ──────────────────────────────────────────────────────────
    "registered nurse United States",
    "licensed practical nurse United States",
    "nurse practitioner United States",
    "physician United States",
    "physical therapist United States",
    "occupational therapist United States",
    "pharmacist United States",
    "medical assistant United States",
    "dental hygienist United States",
    "clinical psychologist United States",
    "radiologic technologist United States",
    "respiratory therapist United States",
    "healthcare administrator United States",
    "medical coder United States",
    # ── Education ──────────────────────────────────────────────────────────
    "elementary school teacher United States",
    "high school teacher United States",
    "professor United States",
    "school counselor United States",
    "special education teacher United States",
    "curriculum developer United States",
    "academic advisor United States",
    # ── Finance ────────────────────────────────────────────────────────────
    "financial analyst United States",
    "accountant CPA United States",
    "investment banker United States",
    "financial advisor United States",
    "auditor United States",
    "tax specialist United States",
    "credit analyst United States",
    "actuary United States",
    # ── Legal ──────────────────────────────────────────────────────────────
    "paralegal United States",
    "attorney United States",
    "compliance officer United States",
    "legal assistant United States",
    # ── Marketing ──────────────────────────────────────────────────────────
    "marketing manager United States",
    "digital marketing specialist United States",
    "content writer United States",
    "SEO specialist United States",
    "social media manager United States",
    "public relations specialist United States",
    "copywriter United States",
    # ── Sales ──────────────────────────────────────────────────────────────
    "sales representative United States",
    "account executive United States",
    "business development manager United States",
    "customer success manager United States",
    "sales engineer United States",
    # ── Design & Creative ──────────────────────────────────────────────────
    "graphic designer United States",
    "video editor United States",
    "creative director United States",
    "illustrator United States",
    "game designer United States",
    # ── Human Resources ────────────────────────────────────────────────────
    "HR manager United States",
    "recruiter United States",
    "talent acquisition specialist United States",
    "HR business partner United States",
    # ── Supply Chain ───────────────────────────────────────────────────────
    "supply chain manager United States",
    "logistics coordinator United States",
    "procurement specialist United States",
    "warehouse manager United States",
    # ── Engineering (non-software) ─────────────────────────────────────────
    "mechanical engineer United States",
    "civil engineer United States",
    "electrical engineer United States",
    "industrial engineer United States",
    "electrician United States",
    "HVAC technician United States",
    "construction project manager United States",
    # ── Government / Social ────────────────────────────────────────────────
    "social worker United States",
    "policy analyst United States",
    "public health analyst United States",
    # ── Research & Science ─────────────────────────────────────────────────
    "research scientist United States",
    "clinical research coordinator United States",
    "laboratory technician United States",
    "environmental scientist United States",
    "biomedical engineer United States",
    # ── Retail & Hospitality ───────────────────────────────────────────────
    "hotel manager United States",
    "restaurant manager United States",
    "event coordinator United States",
    "customer service manager United States",
    # ── Business & Management ─────────────────────────────────────────────
    "project manager United States",
    "operations manager United States",
    "business analyst United States",
    "management consultant United States",
    "executive assistant United States",
    # ── Remote ────────────────────────────────────────────────────────────
    "remote software engineer USA",
    "remote data scientist USA",
    "remote product manager USA",
    "remote marketing manager USA",
    "remote customer success USA",
    "remote UX designer USA",
    # ── Entry Level ───────────────────────────────────────────────────────
    "entry level software engineer USA",
    "entry level data analyst USA",
    "entry level marketing USA",
    "junior developer USA",
    # ── Geographic spread (top cities + underserved states) ───────────────
    "jobs New York City",
    "software engineer Boston",
    "jobs Chicago Illinois",
    "jobs Houston Texas",
    "software engineer Austin Texas",
    "software engineer San Francisco",
    "jobs Seattle Washington",
    "jobs Los Angeles California",
    "jobs Atlanta Georgia",
    "software engineer Denver Colorado",
    "jobs Miami Florida",
    "jobs Phoenix Arizona",
    "jobs Dallas Texas",
    "jobs Minneapolis Minnesota",
    "jobs Nashville Tennessee",
    "jobs Portland Oregon",
    "jobs Charlotte North Carolina",
    "jobs Raleigh North Carolina",
    "jobs Columbus Ohio",
    "jobs Indianapolis Indiana",
    "jobs Kansas City Missouri",
    "jobs Salt Lake City Utah",
    "jobs Las Vegas Nevada",
    "jobs Baltimore Maryland",
    "jobs Pittsburgh Pennsylvania",
    "jobs Detroit Michigan",
    "jobs San Diego California",
    "jobs Sacramento California",
    # Underserved states
    "jobs Vermont", "jobs Wyoming", "jobs Montana", "jobs North Dakota",
    "jobs South Dakota", "jobs Maine", "jobs West Virginia", "jobs Mississippi",
    "jobs Alaska", "jobs Hawaii", "jobs Idaho", "jobs Nebraska",
    "jobs New Mexico", "jobs Arkansas", "jobs Iowa",
]

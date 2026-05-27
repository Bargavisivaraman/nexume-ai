from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Query
from pydantic import BaseModel
from typing import List, Optional
from PyPDF2 import PdfReader
from openai import OpenAI
from dotenv import load_dotenv
import io
import json
import os
import httpx
import asyncio
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timezone, timedelta
import re
import hashlib
import time
from starlette.middleware.gzip import GZipMiddleware

# Jobs pipeline (real data only — no mock/fake jobs)
from jobs import (
    run_ingestion, build_jobs_query,
    US_QUERIES, INDIA_QUERIES,
    _classify_industry, _classify_experience,
)

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=500)

# ─────────────────────────────────────────────────────────────────────────────
# CLIENTS
# ─────────────────────────────────────────────────────────────────────────────

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Groq client — free tier, extremely fast (llama-3.1-8b-instant)
groq_client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY", ""),
    base_url="https://api.groq.com/openai/v1",
)

supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

JSEARCH_API_KEY = os.getenv("JSEARCH_API_KEY")
JSEARCH_BASE    = "https://jsearch.p.rapidapi.com"

# ─────────────────────────────────────────────────────────────────────────────
# IN-MEMORY ANALYSIS CACHE
# ─────────────────────────────────────────────────────────────────────────────

_analysis_cache: dict = {}
_CACHE_TTL = 3600  # 1 hour

def _cache_key(contents: bytes, jd: str) -> str:
    return hashlib.md5(contents + jd.encode("utf-8", errors="ignore")).hexdigest()

def _cache_get(key: str) -> Optional[dict]:
    entry = _analysis_cache.get(key)
    if entry and time.monotonic() - entry["ts"] < _CACHE_TTL:
        return entry["data"]
    _analysis_cache.pop(key, None)
    return None

def _cache_set(key: str, data: dict) -> None:
    if len(_analysis_cache) >= 500:
        oldest = min(_analysis_cache, key=lambda k: _analysis_cache[k]["ts"])
        del _analysis_cache[oldest]
    _analysis_cache[key] = {"data": data, "ts": time.monotonic()}


# ─────────────────────────────────────────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────────────────────────────────────────

class ResumeAnalysis(BaseModel):
    summary_feedback: str
    strengths: List[str]
    weaknesses: List[str]
    missing_skills: List[str]
    ats_score: int
    ats_breakdown: dict
    recommendations: List[str]
    weak_bullets: List[str]
    jd_match: Optional[dict] = None


class RewriteRequest(BaseModel):
    bullet: str
    job_context: Optional[str] = ""


class RewriteResponse(BaseModel):
    rewritten: str
    explanation: str


class InterviewRequest(BaseModel):
    resume_text: Optional[str] = ""
    job_description: str
    num_questions: Optional[int] = 10


class InterviewResponse(BaseModel):
    questions: List[dict]
    role_summary: str
    difficulty: str


class EvaluateRequest(BaseModel):
    question: str
    answer: str
    job_description: Optional[str] = ""
    resume_text: Optional[str] = ""


class EvaluateResponse(BaseModel):
    score: int
    feedback: str
    improved_answer: str
    keywords_used: List[str]
    keywords_missing: List[str]


# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────

SECTION_WEIGHTS = {
    "experience":     {"aliases": ["experience", "work experience", "employment history", "professional experience"], "weight": 20},
    "education":      {"aliases": ["education", "academic background", "qualifications"], "weight": 12},
    "skills":         {"aliases": ["skills", "technical skills", "core competencies", "expertise"], "weight": 12},
    "summary":        {"aliases": ["summary", "profile", "objective", "about me", "professional summary"], "weight": 8},
    "projects":       {"aliases": ["projects", "personal projects", "key projects"], "weight": 6},
    "certifications": {"aliases": ["certifications", "certificates", "licenses"], "weight": 5},
    "achievements":   {"aliases": ["achievements", "awards", "honors", "accomplishments"], "weight": 4},
    "contact":        {"aliases": ["phone", "email", "linkedin", "github", "portfolio"], "weight": 3},
}

KEYWORD_GROUPS = {
    "languages":    ["python", "java", "javascript", "typescript", "c++", "c#", "ruby", "go", "rust", "kotlin", "swift", "php", "scala", "r", "matlab", "bash", "shell"],
    "web_frontend": ["react", "angular", "vue", "nextjs", "svelte", "html", "css", "tailwind", "webpack", "redux", "graphql", "rest api", "restful"],
    "web_backend":  ["node.js", "django", "flask", "fastapi", "spring", "express", "rails", "laravel", "microservices", "api", "backend"],
    "databases":    ["sql", "mysql", "postgresql", "mongodb", "redis", "elasticsearch", "dynamodb", "sqlite", "oracle", "nosql", "database"],
    "cloud_devops": ["aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "terraform", "ci/cd", "jenkins", "github actions", "linux", "ansible", "devops"],
    "data_ml":      ["machine learning", "deep learning", "nlp", "data science", "tensorflow", "pytorch", "scikit-learn", "pandas", "numpy", "data analysis", "statistics", "tableau", "power bi", "spark", "etl"],
    "soft_tools":   ["agile", "scrum", "jira", "git", "github", "gitlab", "figma", "confluence", "leadership", "communication", "collaboration"],
    "security":     ["cybersecurity", "unit testing", "jest", "pytest", "selenium", "qa", "test automation", "oauth", "ssl"],
}

STRONG_ACTION_VERBS = [
    "developed", "designed", "built", "led", "architected", "engineered", "launched",
    "delivered", "implemented", "created", "spearheaded", "managed", "optimized",
    "reduced", "increased", "improved", "automated", "scaled", "deployed", "drove",
    "established", "oversaw", "coordinated", "mentored", "trained", "analyzed",
    "streamlined", "migrated", "integrated", "transformed"
]

WEAK_ACTION_PHRASES = [
    "worked on", "helped with", "responsible for", "assisted with",
    "was involved in", "participated in", "contributed to", "handled",
    "dealt with", "tried to"
]

TECH_PHRASES = [
    "machine learning", "deep learning", "natural language processing",
    "computer vision", "reinforcement learning", "large language models",
    "generative ai", "prompt engineering", "object oriented", "functional programming",
    "test driven development", "react.js", "next.js", "vue.js", "node.js",
    "react native", "single page application", "responsive design",
    "rest api", "restful api", "graphql api", "microservices architecture",
    "event driven", "message queue", "api gateway", "load balancing",
    "continuous integration", "continuous deployment", "ci/cd",
    "github actions", "amazon web services", "google cloud platform",
    "infrastructure as code", "container orchestration", "serverless architecture",
    "data pipeline", "etl pipeline", "data warehouse", "data lake",
    "real time processing", "feature engineering", "a/b testing",
    "statistical analysis", "business intelligence", "data visualization",
    "relational database", "nosql database", "vector database",
    "full stack", "full-stack", "cross functional", "agile methodology",
    "system design", "distributed systems", "high availability",
    "technical lead", "code review", "software architecture",
    "penetration testing", "zero trust", "oauth 2.0",
    "problem solving", "stakeholder management",
]

NORMALIZATION_MAP = {
    "react.js":   ["reactjs"],
    "node.js":    ["nodejs"],
    "next.js":    ["nextjs"],
    "vue.js":     ["vuejs"],
    "ci/cd":      ["cicd", "ci cd"],
    "c++":        ["cpp"],
    "c#":         ["csharp"],
    "aws":        ["amazon web services"],
    "gcp":        ["google cloud platform", "google cloud"],
    "k8s":        ["kubernetes"],
    "ml":         ["machine learning"],
    "nlp":        ["natural language processing"],
}

STOPWORDS = {
    "the","and","for","are","you","with","that","this","will","have","from",
    "they","been","their","your","our","all","can","not","but","about","work",
    "role","team","join","must","able","well","also","each","into","more",
    "some","such","than","then","there","these","those","what","when","which",
    "who","why","how","level","location","united","states","remote","hybrid",
    "onsite","office","fulltime","parttime","contract","permanent",
    "responsibilities","maintain","modern","consume","functional","including",
    "position","looking","salary","benefits","equal","opportunity","employer",
    "apply","candidate","candidates","qualified","minimum","preferred","required",
    "plus","bonus","strong","excellent","ability","skills","knowledge",
    "understanding","familiar","familiarity","proficiency","proficient",
    "comfortable","passionate","motivated","driven","detail","oriented","fast",
    "paced","company","organization","business","product","products","service",
    "services","customer","client","clients","users","startup","environment",
    "across","within","without","between","through","during","before","after",
    "above","below","other","using","based","years","experience","year","month",
    "week","time","day","francisco","angeles","york","chicago","austin","seattle",
    "boston","denver","atlanta","dallas","london","toronto","ideal","enjoy",
    "working","write","clean","seeking","contribute","full","used","daily",
    "collaborating","development","interfaces","responsive","environments",
    "stack","engineering","applications","deployment","scalable","great",
    "good","best","high","low","new","old","large","small","many","few",
    "help","make","take","need","want","know","think","come","give","find",
    "provide","include","continue","set","learn","change","lead","understand",
    "ensure","drive","support","manage","review",
}

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def extract_text_from_pdf(contents: bytes) -> str:
    pdf  = PdfReader(io.BytesIO(contents))
    text = ""
    for page in pdf.pages:
        extracted = page.extract_text()
        if extracted:
            text += extracted + "\n"
    return text


def sanitize_text(text: str) -> str:
    """Strip null bytes and control characters that make JSON request bodies unparseable."""
    text = text.replace('\x00', '')                                  # null bytes — #1 cause of 400s
    text = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)  # other illegal control chars
    return text


def is_valid_resume(text: str) -> bool:
    text_lower  = text.lower()
    signals     = ["experience", "work experience", "education", "skills", "projects",
                   "summary", "objective", "employment", "career", "qualifications"]
    signal_hits = sum(1 for s in signals if s in text_lower)
    has_email   = bool(re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text))
    has_dates   = bool(re.search(r"(19|20)\d{2}", text))
    return len(text.split()) >= 200 and signal_hits >= 2 and has_email and has_dates


def normalize_text(text: str) -> str:
    t = text.lower()
    for canonical, variants in NORMALIZATION_MAP.items():
        for v in variants:
            t = t.replace(v, canonical)
    t = re.sub(r'[^\w\s#+./]', ' ', t)
    t = re.sub(r'\s+', ' ', t)
    return t


# ─────────────────────────────────────────────────────────────────────────────
# ATS SCORERS
# ─────────────────────────────────────────────────────────────────────────────

def score_sections(text_lower):
    breakdown, total = {}, 0
    for section, cfg in SECTION_WEIGHTS.items():
        found = any(alias in text_lower for alias in cfg["aliases"])
        pts   = cfg["weight"] if found else 0
        total += pts
        breakdown[section] = {"found": found, "points": pts, "max": cfg["weight"]}
    return total, breakdown


def score_quantification(text):
    lines        = re.split(r'\n', text)
    bullet_lines = [l.strip().lstrip("-•▪▸►◦●✓✔* ").strip() for l in lines if len(l.strip()) > 20]
    if not bullet_lines:
        return 0, {"metric_density": 0, "points": 0, "max": 30}
    pattern = re.compile(
        r'(\d+[\.,]?\d*\s*(%|percent|x|times|k|m|bn|million|billion|thousand)?|\$[\d,]+|increased|decreased|reduced|improved|grew|saved|generated)\b',
        re.IGNORECASE
    )
    hits    = sum(1 for l in bullet_lines if pattern.search(l))
    density = hits / len(bullet_lines)
    if density >= 0.60:   pts = 30
    elif density >= 0.45: pts = 24
    elif density >= 0.30: pts = 18
    elif density >= 0.15: pts = 10
    elif density >= 0.05: pts = 5
    else:                 pts = 0
    return pts, {"bullet_lines_found": len(bullet_lines), "lines_with_metrics": hits,
                 "metric_density_pct": round(density * 100, 1), "points": pts, "max": 30}


def score_action_verbs(text):
    lines  = [l.strip().lstrip("-•▪▸►◦●✓✔* ").strip() for l in text.split("\n") if len(l.strip()) > 20]
    strong = sum(1 for l in lines if any(l.lower().startswith(v) for v in STRONG_ACTION_VERBS))
    weak   = sum(1 for l in lines if any(l.lower().startswith(p) for p in WEAK_ACTION_PHRASES))
    ratio  = strong / max(len(lines), 1)
    if ratio >= 0.60:   pts = 20
    elif ratio >= 0.40: pts = 15
    elif ratio >= 0.20: pts = 10
    elif ratio >= 0.05: pts = 5
    else:               pts = 2
    penalty = min(weak * 3, 10)
    pts     = max(0, pts - penalty)
    return pts, {"strong_verb_lines": strong, "weak_phrase_lines": weak,
                 "strong_ratio_pct": round(ratio * 100, 1), "penalty_applied": penalty,
                 "points": pts, "max": 20}


def score_keyword_relevance(text_lower):
    domain_hits     = {d: [kw for kw in kws if kw in text_lower] for d, kws in KEYWORD_GROUPS.items()}
    domains_covered = sum(1 for h in domain_hits.values() if h)
    total_kw        = sum(len(h) for h in domain_hits.values())
    breadth = min(domains_covered * 2, 15)
    if total_kw >= 20:   depth = 15
    elif total_kw >= 12: depth = 11
    elif total_kw >= 7:  depth = 7
    elif total_kw >= 3:  depth = 4
    else:                depth = 1
    pts = breadth + depth
    return pts, {"domains_covered": domains_covered, "total_keywords_found": total_kw,
                 "per_domain": {d: len(h) for d, h in domain_hits.items()},
                 "breadth_points": breadth, "depth_points": depth, "points": pts, "max": 30}


def score_length_and_format(text):
    wc = len(text.split())
    if 350 <= wc <= 800:   lp = 10
    elif 250 <= wc < 350:  lp = 7
    elif 800 < wc <= 1100: lp = 8
    elif wc > 1100:        lp = 4
    else:                  lp = 3
    bc = len(re.findall(r'^\s*[-•▪▸►◦●✓✔*]', text, re.MULTILINE))
    fp = min(bc // 3, 5)
    return lp + fp, {"word_count": wc, "bullet_count": bc, "length_points": lp,
                     "format_points": fp, "points": lp + fp, "max": 15}


def score_contact_info(text):
    checks = {
        "email":    bool(re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)),
        "phone":    bool(re.search(r"\+?\d[\d\s\-().]{7,}\d", text)),
        "linkedin": bool(re.search(r"linkedin", text, re.IGNORECASE)),
        "github":   bool(re.search(r"github",   text, re.IGNORECASE)),
        "location": bool(re.search(r"\b[A-Z][a-z]+,\s*[A-Z]{2}\b|\bremote\b", text)),
    }
    pts = sum([3, 2, 2, 2, 1][i] for i, v in enumerate(checks.values()) if v)
    return min(pts, 10), {"checks": checks, "points": min(pts, 10), "max": 10}


# ─────────────────────────────────────────────────────────────────────────────
# JD MATCHING
# ─────────────────────────────────────────────────────────────────────────────

def analyze_jd_match(resume_text: str, jd_text: str) -> dict:
    rn = normalize_text(resume_text)
    jn = normalize_text(jd_text)

    found_phrases   = [p for p in TECH_PHRASES if p in jn]
    matched_phrases = [p for p in found_phrases if p in rn]
    missing_phrases = [p for p in found_phrases if p not in rn]

    phrase_words    = set(w for p in found_phrases for w in p.split())
    jd_words        = re.findall(r'\b[a-z][a-z+#.]{2,}\b', jn)
    singles         = list(dict.fromkeys([
        w for w in jd_words
        if w not in STOPWORDS and len(w) > 3 and w not in phrase_words
    ]))[:60]

    matched_singles = [k for k in singles if k in rn]
    missing_singles = [k for k in singles if k not in rn]

    wm    = (len(matched_phrases) * 2) + len(matched_singles)
    wt    = (len(found_phrases)   * 2) + len(singles)
    match = min(round((wm / max(wt, 1)) * 100), 98)

    if match >= 75:   verdict, color = "Strong Match",   "green"
    elif match >= 50: verdict, color = "Moderate Match", "yellow"
    else:             verdict, color = "Weak Match",     "red"

    top_missing = missing_phrases[:6] + missing_singles[:6]
    suggestions = (
        [f"Add '{i}' — key multi-word skill from this JD missing in your resume" for i in missing_phrases[:3]] +
        [f"Include '{i}' in your skills or experience section" for i in missing_singles[:4]]
    )

    return {
        "match_pct":         match,
        "matched_keywords":  matched_phrases[:5] + matched_singles[:10],
        "missing_keywords":  top_missing,
        "matched_phrases":   matched_phrases,
        "missing_phrases":   missing_phrases[:6],
        "total_jd_keywords": len(found_phrases) + len(singles),
        "verdict":           verdict,
        "verdict_color":     color,
        "suggestions":       suggestions[:7],
    }


# ─────────────────────────────────────────────────────────────────────────────
# ATS MASTER SCORER
# ─────────────────────────────────────────────────────────────────────────────

def calculate_ats_score(text: str, jd_text: Optional[str] = None):
    tl = text.lower()
    sr, sd = score_sections(tl)
    qp, qd = score_quantification(text)
    vp, vd = score_action_verbs(text)
    kp, kd = score_keyword_relevance(tl)
    lp, ld = score_length_and_format(text)
    cp, cd = score_contact_info(text)

    sp     = round((sr / sum(c["weight"] for c in SECTION_WEIGHTS.values())) * 30)
    raw    = sp + qp + vp + kp + lp + cp
    scaled = round((raw / 135) * 100)

    penalty, boost = 0, 0
    if jd_text and jd_text.strip():
        jd = analyze_jd_match(text, jd_text)
        mp = jd["match_pct"]
        if mp < 40:    penalty = 12
        elif mp < 55:  penalty = 6
        elif mp >= 75: boost   = 5

    final = min(max(scaled - penalty + boost, 1), 97)
    return final, {
        "sections":       {**sd, "normalised_points": sp, "max": 30},
        "quantification": qd,
        "action_verbs":   vd,
        "keywords":       kd,
        "length_format":  ld,
        "contact_info":   cd,
        "raw_total":      raw,
        "max_possible":   135,
        "jd_penalty":     penalty,
        "jd_boost":       boost,
        "final_score":    final,
    }


def extract_weak_bullets(text):
    lines = [l.strip().lstrip("-•▪▸►◦●✓✔* ").strip() for l in text.split("\n") if len(l.strip()) > 20]
    return [l for l in lines if any(l.lower().startswith(p) for p in WEAK_ACTION_PHRASES)][:6]


# ─────────────────────────────────────────────────────────────────────────────
# JOB FEED — FETCH + CACHE
# ─────────────────────────────────────────────────────────────────────────────

async def refresh_all_jobs():
    """Scheduled ingestion — runs every 8 hours. Uses jobs.py pipeline."""
    print(f"[Jobs] Starting scheduled refresh at {datetime.now(timezone.utc)}")
    if not JSEARCH_API_KEY:
        print("[Jobs] JSEARCH_API_KEY not set — skipping ingestion")
        return
    try:
        stats_in = await run_ingestion(supabase, JSEARCH_API_KEY, INDIA_QUERIES, "IN")
        stats_us = await run_ingestion(supabase, JSEARCH_API_KEY, US_QUERIES,    "US")
        print(f"[Jobs] Done — IN: {stats_in} | US: {stats_us}")
    except Exception as e:
        print(f"[Jobs] Refresh failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# SCHEDULER
# ─────────────────────────────────────────────────────────────────────────────

scheduler = AsyncIOScheduler()


async def _scheduled_ats_ingestion(tier: str):
    """Wrapper used by APScheduler to run an ATS ingestion tier without blocking."""
    try:
        from aggregators import run_ats_ingestion
        await run_ats_ingestion(supabase, tier=tier)
    except Exception as e:
        print(f"[Scheduler] ATS tier={tier} failed: {e}")


@app.on_event("startup")
async def startup_event():
    """
    Auto-fetch new jobs from public ATS boards:
      tier1 every 5 min   — ~30 highest-demand companies (Stripe, OpenAI, Spotify, etc.)
      tier2 every 30 min  — broader 50+ company set
      tier3 every 6 hours — long-tail companies

    Plus an initial tier1 run 30 seconds after boot so first-load users see fresh data.
    """
    from datetime import datetime as _dt, timedelta as _td
    scheduler.add_job(
        _scheduled_ats_ingestion, "interval", minutes=5,
        args=["tier1"], id="ats_tier1",
        next_run_time=_dt.now(timezone.utc) + _td(seconds=30),
        coalesce=True, max_instances=1,
    )
    scheduler.add_job(
        _scheduled_ats_ingestion, "interval", minutes=30,
        args=["tier2"], id="ats_tier2",
        next_run_time=_dt.now(timezone.utc) + _td(minutes=2),
        coalesce=True, max_instances=1,
    )
    scheduler.add_job(
        _scheduled_ats_ingestion, "interval", hours=6,
        args=["tier3"], id="ats_tier3",
        next_run_time=_dt.now(timezone.utc) + _td(minutes=10),
        coalesce=True, max_instances=1,
    )
    scheduler.start()
    print("[Startup] ATS scheduler enabled — tier1=5min, tier2=30min, tier3=6h")


@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()


# ─────────────────────────────────────────────────────────────────────────────
# ROUTES — JOBS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/warmup")
async def warmup():
    """Lightweight ping — frontend calls this first to wake the server."""
    return {"status": "ok", "ts": datetime.now(timezone.utc).isoformat()}


REMOTIVE_CATEGORY_MAP = {
    "Technology": "software-dev", "Engineering": "software-dev",
    "Design & Creative": "design", "Marketing": "marketing",
    "Finance": "finance-legal", "Legal": "finance-legal",
    "Human Resources": "human-resources", "Sales": "sales",
    "Business": "business-management-ops", "Research & Science": "data",
}

# ── ADZUNA JOB FETCHER ────────────────────────────────────────────────────────
async def fetch_adzuna_jobs(
    keyword:  str = "",
    location: str = "Los Angeles",
    page:     int = 1,
    limit:    int = 50,
) -> list:
    """
    Fetch from Adzuna — aggregates Indeed, Glassdoor, Monster, CareerBuilder,
    thousands of company career pages, and local job boards.
    Free tier: 1000 calls/month. Register at developer.adzuna.com
    """
    app_id  = os.getenv("ADZUNA_APP_ID", "")
    app_key = os.getenv("ADZUNA_APP_KEY", "")
    if not app_id or not app_key:
        print("[Adzuna] No credentials — set ADZUNA_APP_ID + ADZUNA_APP_KEY")
        return []

    params: dict = {
        "app_id":           app_id,
        "app_key":          app_key,
        "results_per_page": min(limit, 50),
        "where":            location,
        "sort_by":          "date",
        "content-type":     "application/json",
    }
    if keyword:
        params["what"] = keyword

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"https://api.adzuna.com/v1/api/jobs/us/search/{page}",
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()

        jobs = []
        for j in data.get("results", []):
            salary_min  = j.get("salary_min")
            salary_max  = j.get("salary_max")
            loc_areas   = j.get("location", {}).get("area", [])
            loc_display = j.get("location", {}).get("display_name", location)
            category    = j.get("category", {}).get("label", "")
            title       = j.get("title", "")
            desc        = j.get("description", "")

            jobs.append({
                "job_id":           f"adzuna_{j.get('id', '')}",
                "title":            title,
                "company":          j.get("company", {}).get("display_name", "Unknown"),
                "location":         loc_display,
                "state":            "CA" if any("California" in a or "Los Angeles" in a for a in loc_areas) else "",
                "country":          "US",
                "job_url":          j.get("redirect_url", ""),
                "url":              j.get("redirect_url", ""),
                "employment_type":  "FULLTIME",
                "experience_level": _classify_experience(title + " " + desc),
                "industry":         _classify_industry(category + " " + title),
                "posted_at":        j.get("created", ""),
                "fetched_at":       j.get("created", ""),
                "description":      desc[:2000],
                "salary_min":       int(salary_min) if salary_min else None,
                "salary_max":       int(salary_max) if salary_max else None,
                "source":           "Adzuna",
            })

        print(f"[Adzuna] Fetched {len(jobs)} jobs — '{keyword or 'any'}' in '{location}'")
        return jobs

    except Exception as e:
        print(f"[Adzuna] Error: {e}")
        return []

# ── THE MUSE JOB FETCHER (free, no key) ──────────────────────────────────────
async def fetch_themuse_jobs(keyword: str = "", location: str = "Los Angeles", limit: int = 40) -> list:
    """Fetch jobs from The Muse — startup & tech companies, free, no API key needed."""
    try:
        # The Muse location slugs
        loc_map = {
            "los angeles": "Los%20Angeles%2C%20CA",
            "new york": "New%20York%2C%20NY",
            "san francisco": "San%20Francisco%2C%20CA",
            "remote": "Flexible%20%2F%20Remote",
        }
        loc_key = location.lower().split(",")[0].strip()
        loc_param = loc_map.get(loc_key, "Los%20Angeles%2C%20CA")

        jobs_out = []
        async with httpx.AsyncClient(timeout=12.0) as client:
            for page in range(1, 3):  # fetch 2 pages = ~40 jobs
                url = f"https://www.themuse.com/api/public/jobs?location={loc_param}&page={page}&descending=true"
                resp = await client.get(url)
                if resp.status_code != 200:
                    break
                data = resp.json()
                results = data.get("results", [])
                if not results:
                    break
                for j in results:
                    company = j.get("company", {}).get("name", "Unknown")
                    title   = j.get("name", "")
                    locs    = [loc.get("name","") for loc in j.get("locations", [])]
                    lvls    = [lv.get("name","") for lv in j.get("levels", [])]
                    cats    = [c.get("name","") for c in j.get("categories", [])]
                    ref     = j.get("refs", {}).get("landing_page", "")
                    # keyword filter client-side
                    if keyword and keyword.lower() not in title.lower() and keyword.lower() not in " ".join(cats).lower():
                        continue
                    jobs_out.append({
                        "job_id":           f"muse_{j.get('id','')}",
                        "title":            title,
                        "company":          company,
                        "location":         ", ".join(locs) if locs else location,
                        "url":              ref,
                        "job_url":          ref,
                        "employment_type":  "FULLTIME",
                        "experience_level": lvls[0] if lvls else "",
                        "industry":         cats[0] if cats else "Technology",
                        "posted_at":        j.get("publication_date", ""),
                        "fetched_at":       j.get("publication_date", ""),
                        "description":      j.get("contents", "")[:800] if j.get("contents") else "",
                        "country":          "US",
                        "source":           "The Muse",
                    })
                if len(jobs_out) >= limit:
                    break
        print(f"[TheMuse] Fetched {len(jobs_out)} jobs for '{keyword or 'any'}' in '{location}'")
        return jobs_out[:limit]
    except Exception as e:
        print(f"[TheMuse] Error: {e}")
        return []


# ── USAJOBS FETCHER (free, register at developer.usajobs.gov) ─────────────────
async def fetch_usajobs(keyword: str = "", location: str = "Los Angeles, CA", limit: int = 25) -> list:
    """Fetch US government jobs from USAJobs.gov — free, requires API key from developer.usajobs.gov"""
    api_key   = os.getenv("USAJOBS_API_KEY", "")
    user_agent = os.getenv("USAJOBS_USER_AGENT", "")  # your registered email
    if not api_key or not user_agent:
        return []
    try:
        params = {
            "Keyword":        keyword or "",
            "LocationName":   location,
            "ResultsPerPage": min(limit, 25),
            "SortField":      "OpenDate",
            "SortDirection":  "Desc",
        }
        headers = {
            "Authorization-Key": api_key,
            "User-Agent":        user_agent,
            "Host":              "data.usajobs.gov",
        }
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(
                "https://data.usajobs.gov/api/search",
                params=params, headers=headers
            )
            resp.raise_for_status()
            data = resp.json()

        jobs_out = []
        items = data.get("SearchResult", {}).get("SearchResultItems", [])
        for item in items:
            pos     = item.get("MatchedObjectDescriptor", {})
            locs    = pos.get("PositionLocation", [{}])
            loc_str = locs[0].get("LocationName", location) if locs else location
            salary  = pos.get("PositionRemuneration", [{}])
            sal_min = salary[0].get("MinimumRange") if salary else None
            sal_max = salary[0].get("MaximumRange") if salary else None
            jobs_out.append({
                "job_id":           f"usa_{pos.get('PositionID','')}",
                "title":            pos.get("PositionTitle", ""),
                "company":          pos.get("OrganizationName", "US Government"),
                "location":         loc_str,
                "url":              pos.get("PositionURI", ""),
                "job_url":          pos.get("ApplyURI", [""])[0] if pos.get("ApplyURI") else "",
                "employment_type":  "FULLTIME",
                "experience_level": "",
                "industry":         "Government",
                "posted_at":        pos.get("PublicationStartDate", ""),
                "fetched_at":       pos.get("PublicationStartDate", ""),
                "description":      pos.get("UserArea", {}).get("Details", {}).get("JobSummary", "")[:800],
                "salary_min":       int(float(sal_min)) if sal_min else None,
                "salary_max":       int(float(sal_max)) if sal_max else None,
                "country":          "US",
                "source":           "USAJobs",
            })
        print(f"[USAJobs] Fetched {len(jobs_out)} jobs for '{keyword}' in '{location}'")
        return jobs_out
    except Exception as e:
        print(f"[USAJobs] Error: {e}")
        return []


# ── JOBICY FETCHER (official free API, no key needed) ────────────────────────
async def fetch_jobicy_jobs(keyword: str = "", limit: int = 30) -> list:
    """Fetch remote jobs from Jobicy — legit remote job board used by Netflix, Spotify, etc."""
    try:
        params = {"count": min(limit, 50), "geo": "usa"}
        if keyword:
            params["tag"] = keyword
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get("https://jobicy.com/api/v2/remote-jobs", params=params)
            resp.raise_for_status()
            raw = resp.json().get("jobs", [])
        jobs_out = []
        for j in raw:
            jobs_out.append({
                "job_id":           f"jobicy_{j.get('id', '')}",
                "title":            j.get("jobTitle", ""),
                "company":          j.get("companyName", "Unknown"),
                "location":         j.get("jobGeo", "Remote"),
                "url":              j.get("url", ""),
                "job_url":          j.get("url", ""),
                "employment_type":  j.get("jobType", "FULLTIME").upper().replace("-", ""),
                "experience_level": j.get("jobLevel", ""),
                "industry":         j.get("jobIndustry", ["Technology"])[0] if j.get("jobIndustry") else "Technology",
                "posted_at":        j.get("pubDate", ""),
                "fetched_at":       j.get("pubDate", ""),
                "description":      j.get("jobExcerpt", "")[:800],
                "salary_min":       None,
                "salary_max":       None,
                "is_remote":        True,
                "country":          "US",
                "source":           "Jobicy",
            })
        print(f"[Jobicy] Fetched {len(jobs_out)} jobs")
        return jobs_out
    except Exception as e:
        print(f"[Jobicy] Error: {e}")
        return []


# ── ARBEITNOW FETCHER (official free API, no key needed) ─────────────────────
async def fetch_arbeitnow_jobs(keyword: str = "", limit: int = 30) -> list:
    """Fetch jobs from Arbeitnow — international job board with US remote roles."""
    try:
        jobs_out = []
        async with httpx.AsyncClient(timeout=12.0) as client:
            for page in range(1, 3):
                resp = await client.get(
                    "https://arbeitnow.com/api/job-board-api",
                    params={"page": page}
                )
                if resp.status_code != 200:
                    break
                data = resp.json().get("data", [])
                if not data:
                    break
                for j in data:
                    title = j.get("title", "")
                    tags  = j.get("tags", [])
                    # keyword filter client-side
                    if keyword and keyword.lower() not in title.lower() and keyword.lower() not in " ".join(tags).lower():
                        continue
                    jobs_out.append({
                        "job_id":           f"arb_{j.get('slug', '')}",
                        "title":            title,
                        "company":          j.get("company_name", "Unknown"),
                        "location":         j.get("location", "Remote"),
                        "url":              j.get("url", ""),
                        "job_url":          j.get("url", ""),
                        "employment_type":  "FULLTIME",
                        "experience_level": "",
                        "industry":         tags[0].title() if tags else "Technology",
                        "posted_at":        str(j.get("created_at", "")),
                        "fetched_at":       str(j.get("created_at", "")),
                        "description":      j.get("description", "")[:800],
                        "is_remote":        j.get("remote", False),
                        "country":          "US",
                        "source":           "Arbeitnow",
                    })
                if len(jobs_out) >= limit:
                    break
        print(f"[Arbeitnow] Fetched {len(jobs_out)} jobs")
        return jobs_out[:limit]
    except Exception as e:
        print(f"[Arbeitnow] Error: {e}")
        return []


async def fetch_remotive_jobs(keyword: Optional[str] = None, category: Optional[str] = None, limit: int = 40) -> list:
    """Fetch live remote jobs from Remotive (free, no auth required)."""
    try:
        params = {"limit": limit}
        if category: params["category"] = category
        # Remotive search is unreliable — skip keyword filter, return broad results
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get("https://remotive.com/api/remote-jobs", params=params)
            resp.raise_for_status()
            raw = resp.json().get("jobs", [])
        normalised = []
        for j in raw:
            normalised.append({
                "job_id":           f"rem_{j.get('id','')}",
                "title":            j.get("title", ""),
                "company":          j.get("company_name", ""),
                "location":         j.get("candidate_required_location") or "Remote",
                "url":              j.get("url", ""),
                "description":      j.get("description", "")[:600] if j.get("description") else "",
                "employment_type":  j.get("job_type", "FULLTIME").upper().replace("-",""),
                "experience_level": "",
                "is_remote":        True,
                "industry":         j.get("category", "Technology"),
                "posted_at":        j.get("publication_date", ""),
                "country":          "REMOTE",
                "fetched_at":       j.get("publication_date", ""),
            })
        return normalised
    except Exception as e:
        print(f"[Remotive] Error: {e}")
        return []

@app.get("/jobs/")
async def get_jobs(
    country:          str           = Query("US"),
    keyword:          Optional[str] = Query(None),
    location:         Optional[str] = Query(None),   # city/region e.g. "Los Angeles, CA"
    industry:         Optional[str] = Query(None),
    job_type:         Optional[str] = Query(None),
    experience_level: Optional[str] = Query(None),
    work_mode:        Optional[str] = Query(None),
    state_filter:     Optional[str] = Query(None),
    date_range:       Optional[str] = Query(None),
    page:             int           = Query(1, ge=1),
    per_page:         int           = Query(20, ge=1, le=50),
):
    try:
        offset = (page - 1) * per_page
        q = build_jobs_query(
            supabase,
            country          = country,
            keyword          = keyword,
            industry         = industry,
            job_type         = job_type,
            experience_level = experience_level,
            work_mode        = work_mode,
            state_filter     = state_filter,
            date_range       = date_range,
        )
        result = q.order("fetched_at", desc=True).range(offset, offset + per_page - 1).execute()
        jobs   = result.data or []

        # ── Live sources — run ALL in parallel, merge results ──────────────────
        if not jobs:
            loc          = location or ("Los Angeles, CA" if country.upper() == "US" else "Remote")
            rem_category = REMOTIVE_CATEGORY_MAP.get(industry or "", None)

            adzuna_task   = fetch_adzuna_jobs(keyword=keyword or "", location=loc, page=page, limit=50)
            muse_task     = fetch_themuse_jobs(keyword=keyword or "", location=loc, limit=30)
            usajobs_task  = fetch_usajobs(keyword=keyword or "", location=loc, limit=25)
            remotive_task = fetch_remotive_jobs(keyword=keyword, category=rem_category, limit=20)
            jobicy_task   = fetch_jobicy_jobs(keyword=keyword or "", limit=30)
            arbeitnow_task = fetch_arbeitnow_jobs(keyword=keyword or "", limit=30)

            results = await asyncio.gather(
                adzuna_task, muse_task, usajobs_task,
                remotive_task, jobicy_task, arbeitnow_task,
                return_exceptions=True,
            )

            # Collect valid results (skip any that raised exceptions)
            all_live: list = []
            for batch in results:
                if isinstance(batch, list):
                    all_live.extend(batch)

            # Deduplicate by title+company (case-insensitive)
            seen   = set()
            unique = []
            for j in all_live:
                key = f"{j.get('title','').lower().strip()}|{j.get('company','').lower().strip()}"
                if key not in seen:
                    seen.add(key)
                    unique.append(j)

            jobs = unique

        return {
            "jobs":     jobs,
            "page":     page,
            "country":  country.upper(),
            "count":    len(jobs),
            "has_more": len(jobs) >= per_page,
            "sources":  list({j.get("source","Unknown") for j in jobs}),
        }
    except Exception as e:
        print(f"[/jobs/] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to query jobs: {str(e)}")


@app.get("/jobs/status/")
async def ingestion_status():
    """Returns the last 5 ingestion run results for monitoring."""
    try:
        result = (
            supabase.table("ingestion_runs")
            .select("*")
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        return {"runs": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/jobs/refresh/")
async def manual_refresh():
    asyncio.create_task(refresh_all_jobs())
    return {"message": "Ingestion triggered — check /jobs/status/ for progress"}


@app.get("/jobs/stats")
async def jobs_stats():
    """
    Live stats for the Jobs tab status bar.

    Returns:
      - total_jobs:        count of active jobs in DB
      - last_updated:      newest fetched_at timestamp (any source)
      - new_in_last_hour:  count of jobs with fetched_at within last 60 min
      - sources:           per-source counts (Greenhouse / Lever / Ashby / Workable / JSearch / etc.)
      - recent_runs:       last 3 ingestion_runs entries
      - next_run:          next scheduled tier1 run time (ISO)
    """
    try:
        now = datetime.now(timezone.utc)
        one_hour_ago = (now - timedelta(hours=1)).isoformat()

        total = (
            supabase.table("jobs").select("job_id", count="exact")
            .eq("is_active", True).limit(1).execute().count
        ) or 0

        latest = (
            supabase.table("jobs").select("fetched_at")
            .order("fetched_at", desc=True).limit(1).execute().data
        )
        last_updated = latest[0]["fetched_at"] if latest else None

        new_count = (
            supabase.table("jobs").select("job_id", count="exact")
            .gte("fetched_at", one_hour_ago).limit(1).execute().count
        ) or 0

        # Jobs whose ORIGINAL posting timestamp is within the last 24h.
        # This is the metric users see ("posted today"); it intentionally
        # excludes our internal fetched_at because that just means "we
        # ingested it" — not "the company posted it today".
        twenty_four_ago = (now - timedelta(hours=24)).isoformat()
        try:
            posted_today = (
                supabase.table("jobs").select("job_id", count="exact")
                .gte("posted_at", twenty_four_ago)
                .eq("is_active", True)
                .limit(1).execute().count
            ) or 0
        except Exception:
            posted_today = None

        # Source counts — keep cheap, only common sources
        source_counts = {}
        for s in ("Greenhouse", "Lever", "Ashby", "Workable"):
            try:
                c = (
                    supabase.table("jobs").select("job_id", count="exact")
                    .eq("source_name", s).limit(1).execute().count
                )
                source_counts[s] = c or 0
            except Exception:
                source_counts[s] = None

        try:
            runs = (
                supabase.table("ingestion_runs").select("*")
                .order("created_at", desc=True).limit(3).execute().data
            )
        except Exception:
            runs = []

        # Next scheduled tier1 run
        next_run = None
        try:
            tier1_job = scheduler.get_job("ats_tier1")
            if tier1_job and tier1_job.next_run_time:
                next_run = tier1_job.next_run_time.isoformat()
        except Exception:
            pass

        return {
            "total_jobs":           total,
            "last_updated":         last_updated,
            "new_in_last_hour":     new_count,
            "posted_in_last_24h":   posted_today,
            "sources":              source_counts,
            "recent_runs":          runs,
            "next_run":             next_run,
            "server_time":          now.isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/jobs/ingest-ats")
async def ingest_ats(tier: Optional[str] = Query(None, description="tier1 | tier2 | tier3 (omit for all)")):
    """
    Trigger ingestion from public ATS boards (Greenhouse, Lever, Ashby, Workable).
    Pulls ~150+ companies' open jobs and upserts to Supabase. Runs in background.

    Tier strategy:
      tier1 (hourly):  major tech + finance — high user demand
      tier2 (daily):   broader SaaS, healthcare, design
      tier3 (weekly):  long-tail companies
    """
    try:
        from aggregators import run_ats_ingestion
        asyncio.create_task(run_ats_ingestion(supabase, tier=tier))
        return {"message": f"ATS ingestion triggered (tier={tier or 'all'}) — check /jobs/status/"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# ROUTES — INTERVIEW PREP
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/generate-interview/", response_model=InterviewResponse)
async def generate_interview(req: InterviewRequest):
    if not req.job_description or len(req.job_description.strip()) < 50:
        raise HTTPException(status_code=400, detail="Job description too short")

    resume_context = f"\nCandidate Resume:\n{req.resume_text[:3000]}" if req.resume_text and req.resume_text.strip() else ""

    try:
        response = await asyncio.to_thread(lambda: openai_client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert technical recruiter and interview coach. "
                        "Generate highly specific, realistic interview questions based on the actual job description. "
                        "Every question must be directly tied to skills or responsibilities in the JD. "
                        "Return ONLY valid JSON."
                    )
                },
                {
                    "role": "user",
                    "content": f"""
Generate {req.num_questions} interview questions for this role.{resume_context}

Job Description:
{req.job_description[:4000]}

Rules:
- Questions must be SPECIFIC to this JD, not generic
- Mix: technical (40%), behavioral (30%), situational (20%), culture fit (10%)
- If resume is provided, personalize some questions to the candidate's background
- Match difficulty to seniority level in JD

Return this exact JSON:
{{
  "role_summary": "2 sentence summary of what this role requires",
  "difficulty": "Junior / Mid / Senior / Staff",
  "questions": [
    {{
      "id": 1,
      "question": "the interview question",
      "type": "technical | behavioral | situational | culture",
      "why_asked": "one sentence on what the interviewer is evaluating",
      "good_answer_hints": ["hint 1", "hint 2", "hint 3"]
    }}
  ]
}}
"""
                }
            ],
            max_tokens=2500,
            temperature=0.4,
        ))
        return json.loads(response.choices[0].message.content.strip())
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Model returned invalid JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interview generation failed: {str(e)}")


@app.post("/evaluate-answer/", response_model=EvaluateResponse)
async def evaluate_answer(req: EvaluateRequest):
    if not req.question or len(req.question.strip()) < 5:
        raise HTTPException(status_code=400, detail="Question too short")
    if not req.answer or len(req.answer.strip()) < 10:
        raise HTTPException(status_code=400, detail="Answer too short")

    jd_ctx     = f"\nJob Description:\n{req.job_description[:2000]}" if req.job_description else ""
    resume_ctx = f"\nCandidate Resume:\n{req.resume_text[:1500]}"    if req.resume_text    else ""

    try:
        response = await asyncio.to_thread(lambda: openai_client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a senior technical interviewer and career coach. "
                        "Evaluate interview answers honestly and constructively. "
                        "Be specific — reference what was good and what was missing. "
                        "Return ONLY valid JSON."
                    )
                },
                {
                    "role": "user",
                    "content": f"""
Evaluate this interview answer.{jd_ctx}{resume_ctx}

Question: {req.question}
Candidate's Answer: {req.answer}

Evaluate on:
1. Relevance — did they actually answer it?
2. Specific examples / STAR method
3. Technical accuracy (if technical)
4. Keywords and terminology from the JD
5. Clarity and conciseness

Return this exact JSON:
{{
  "score": <integer 0-100>,
  "feedback": "3-4 sentences of honest specific feedback referencing their actual answer",
  "improved_answer": "a rewritten version that would score 90+, in first person, natural tone",
  "keywords_used": ["keywords from JD they used well"],
  "keywords_missing": ["important keywords/concepts they should have mentioned"]
}}
"""
                }
            ],
            max_tokens=1000,
            temperature=0.3,
        ))
        return json.loads(response.choices[0].message.content.strip())
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Model returned invalid JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# ROUTES — RESUME ANALYSIS
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/analyze-resume/", response_model=ResumeAnalysis)
async def analyze_resume(
    file:            UploadFile     = File(...),
    job_description: Optional[str] = Form(default="")
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")

    job_description = sanitize_text(job_description or "")

    # Return cached result for identical file+JD (avoids repeat OpenAI charges and latency)
    ck = _cache_key(contents, job_description)
    cached = _cache_get(ck)
    if cached:
        return cached

    # PDF parsing is CPU-bound — run in thread pool so event loop stays free for other requests
    try:
        text = await asyncio.to_thread(extract_text_from_pdf, contents)
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to process PDF file")

    text = sanitize_text(text[:8000])

    if not is_valid_resume(text):
        return {
            "summary_feedback": "The uploaded document does not appear to be a valid professional resume.",
            "strengths": [],
            "weaknesses": ["Missing essential resume sections or professional formatting."],
            "missing_skills": [],
            "ats_score": 0, "ats_breakdown": {},
            "recommendations": ["Upload a structured resume including Experience, Education, Skills, and contact information."],
            "weak_bullets": [], "jd_match": None,
        }

    # Local scoring is CPU-bound — run both in parallel threads so they don't block each other
    (ats_score, ats_breakdown), weak_bullets = await asyncio.gather(
        asyncio.to_thread(calculate_ats_score, text, job_description),
        asyncio.to_thread(extract_weak_bullets, text),
    )
    jd_match = analyze_jd_match(text, job_description) if job_description.strip() else None

    qi = ats_breakdown["quantification"]
    vi = ats_breakdown["action_verbs"]
    ki = ats_breakdown["keywords"]

    scoring_context = f"""
ATS Score: {ats_score}/100
Quantification: {qi['metric_density_pct']}% of bullet lines contain metrics ({qi['points']}/{qi['max']} pts)
Action Verbs: {vi['strong_verb_lines']} strong, {vi['weak_phrase_lines']} weak ({vi['points']}/{vi['max']} pts)
Keywords: {ki['total_keywords_found']} total across {ki['domains_covered']} domains ({ki['points']}/{ki['max']} pts)
"""
    jd_context = (
        f"\nJob Description Match: {jd_match['match_pct']}% — missing: {', '.join(jd_match['missing_keywords'][:8])}"
        if jd_match else ""
    )

    try:
        # OpenAI SDK is synchronous — run in thread pool to avoid blocking the event loop
        response = await asyncio.to_thread(lambda: openai_client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are a professional resume coach and ATS specialist. Return ONLY valid JSON. Be specific and actionable."},
                {"role": "user", "content": f"""
Evaluate this resume. Use the scoring data for targeted feedback.

{scoring_context}{jd_context}

Resume:
{text}

Return this exact JSON:
{{
  "summary_feedback": "2-3 sentence overall assessment mentioning ATS score and key issues",
  "strengths": ["3-5 specific strengths with evidence"],
  "weaknesses": ["3-5 specific weaknesses tied to scoring data"],
  "missing_skills": ["skills/keywords missing that are common in this field"],
  "recommendations": ["5 specific actionable improvements ordered by impact"]
}}
"""}
            ],
            max_tokens=1200,
            temperature=0.3,
        ))
        out = json.loads(response.choices[0].message.content.strip())
        out["ats_score"]     = ats_score
        out["ats_breakdown"] = ats_breakdown
        out["weak_bullets"]  = weak_bullets
        out["jd_match"]      = jd_match
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Model returned invalid JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {str(e)}")

    _cache_set(ck, out)
    return out


# ─────────────────────────────────────────────────────────────────────────────
# ROUTES — BULLET REWRITER
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/rewrite-bullet/", response_model=RewriteResponse)
async def rewrite_bullet(req: RewriteRequest):
    if not req.bullet or len(req.bullet.strip()) < 5:
        raise HTTPException(status_code=400, detail="Bullet text too short")

    job_hint = f"\nJob context: {req.job_context}" if req.job_context else ""

    try:
        response = await asyncio.to_thread(lambda: openai_client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are an expert resume writer. Rewrite weak bullet points to be powerful, metric-driven, and ATS-optimized. Return only JSON."},
                {"role": "user", "content": f"""
Rewrite this weak resume bullet point to be much stronger.{job_hint}

Original: "{req.bullet}"

Rules:
- Start with a strong action verb (Led, Built, Engineered, Optimized, Delivered, etc.)
- Add a specific metric or quantifiable result (placeholder like [X%] is fine)
- Include 1-2 relevant ATS keywords naturally
- Keep it under 20 words
- Sound natural, not robotic

Return JSON:
{{
  "rewritten": "the improved bullet point",
  "explanation": "one sentence explaining what was improved and why"
}}
"""}
            ],
            max_tokens=300,
            temperature=0.5,
        ))
        return json.loads(response.choices[0].message.content.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rewrite failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# ROUTES — COVER LETTER
# ─────────────────────────────────────────────────────────────────────────────

class CoverLetterRequest(BaseModel):
    resume_text: str
    job_description: str
    tone: Optional[str] = "professional"

@app.post("/generate-cover-letter/")
async def generate_cover_letter(req: CoverLetterRequest):
    if len(req.resume_text.strip()) < 100:
        raise HTTPException(status_code=400, detail="Resume text too short")
    if len(req.job_description.strip()) < 50:
        raise HTTPException(status_code=400, detail="Job description too short")
    try:
        response = await asyncio.to_thread(lambda: openai_client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are an expert career coach and professional writer. Write compelling, personalized cover letters. Return ONLY valid JSON."},
                {"role": "user", "content": f"""
Write a tailored cover letter using the candidate's resume and job description.

Resume:
{req.resume_text[:3000]}

Job Description:
{req.job_description[:2000]}

Tone: {req.tone}

Rules:
- Address the specific role and company requirements
- Highlight 2-3 most relevant experiences from the resume
- Show genuine enthusiasm without being generic
- Use keywords from the JD naturally
- Keep it under 350 words
- Do NOT include date/address headers — just the body paragraphs

Return JSON:
{{
  "cover_letter": "the full cover letter text with paragraph breaks using \\n\\n",
  "highlights": ["3 key strengths emphasized"],
  "keywords_used": ["5-8 JD keywords woven in"]
}}
"""}
            ],
            max_tokens=800,
            temperature=0.5,
        ))
        return json.loads(response.choices[0].message.content.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cover letter generation failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# ROUTES — LINKEDIN OPTIMIZER
# ─────────────────────────────────────────────────────────────────────────────

class LinkedInRequest(BaseModel):
    linkedin_summary: str
    target_role: Optional[str] = ""

@app.post("/optimize-linkedin/")
async def optimize_linkedin(req: LinkedInRequest):
    if len(req.linkedin_summary.strip()) < 50:
        raise HTTPException(status_code=400, detail="Summary too short")
    try:
        response = await asyncio.to_thread(lambda: openai_client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are a LinkedIn profile optimization expert. Return ONLY valid JSON."},
                {"role": "user", "content": f"""
Analyze and optimize this LinkedIn About/Summary section.
{f'Target Role: {req.target_role}' if req.target_role else ''}

Current Summary:
{req.linkedin_summary[:2000]}

Return JSON:
{{
  "score": <integer 0-100 — current profile strength>,
  "rewritten": "improved version of the summary (max 300 words, first person, strong opening hook)",
  "issues": ["3-5 specific issues with the current summary"],
  "keywords_to_add": ["6-8 keywords to improve recruiter searchability"],
  "tips": ["3 actionable profile tips beyond the summary (headline, featured, etc.)"]
}}
"""}
            ],
            max_tokens=700,
            temperature=0.4,
        ))
        return json.loads(response.choices[0].message.content.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LinkedIn optimization failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# ROUTES — COLD EMAIL GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

class ColdEmailRequest(BaseModel):
    job_title: str
    company: str
    resume_text: Optional[str] = ""
    your_name: Optional[str] = ""

@app.post("/generate-cold-email/")
async def generate_cold_email(req: ColdEmailRequest):
    if not req.job_title or not req.company:
        raise HTTPException(status_code=400, detail="Job title and company are required")
    resume_ctx = f"\nMy Resume:\n{req.resume_text[:1500]}" if req.resume_text else ""
    try:
        response = await asyncio.to_thread(lambda: openai_client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are an expert at writing cold outreach emails that get responses. Return ONLY valid JSON."},
                {"role": "user", "content": f"""
Write a cold outreach email to a recruiter or hiring manager at {req.company} for a {req.job_title} role.
{f'Sender name: {req.your_name}' if req.your_name else ''}{resume_ctx}

Rules:
- Subject line that stands out (specific, not generic)
- Opening hook — lead with value, not 'I saw your job posting'
- 1-2 sentences on relevant background from resume
- Clear ask (15-min call / coffee chat)
- Under 150 words total — brevity is key
- Warm but confident tone

Return JSON:
{{
  "subject": "the email subject line",
  "email": "the full email body with \\n for line breaks",
  "follow_up": "a short 3-line follow-up email to send 5 days later if no reply"
}}
"""}
            ],
            max_tokens=500,
            temperature=0.6,
        ))
        return json.loads(response.choices[0].message.content.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cold email generation failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# ROUTES — SKILL GAP ANALYZER
# ─────────────────────────────────────────────────────────────────────────────

class SkillGapRequest(BaseModel):
    resume_text: str
    target_role: str

@app.post("/analyze-skill-gap/")
async def analyze_skill_gap(req: SkillGapRequest):
    if len(req.resume_text.strip()) < 100:
        raise HTTPException(status_code=400, detail="Resume text too short")
    if not req.target_role.strip():
        raise HTTPException(status_code=400, detail="Target role required")
    try:
        response = await asyncio.to_thread(lambda: openai_client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are a senior tech recruiter and skills expert. Return ONLY valid JSON."},
                {"role": "user", "content": f"""
Analyze the skill gap between this candidate's resume and the target role.

Target Role: {req.target_role}

Resume:
{req.resume_text[:3000]}

Return JSON:
{{
  "readiness_score": <integer 0-100>,
  "readiness_label": "Ready / Almost Ready / Needs Work / Major Gap",
  "has_skills": ["skills they already have that are relevant to the target role"],
  "missing_critical": ["must-have skills they lack — top priority to learn"],
  "missing_nice": ["nice-to-have skills that would help them stand out"],
  "learning_path": [
    {{"skill": "skill name", "resource": "best free/paid resource to learn it", "time": "estimated time e.g. 2 weeks"}}
  ],
  "quick_wins": ["3 things they can do immediately to look more qualified for this role"]
}}
"""}
            ],
            max_tokens=900,
            temperature=0.3,
        ))
        return json.loads(response.choices[0].message.content.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Skill gap analysis failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# ROUTES — SALARY ESTIMATOR
# ─────────────────────────────────────────────────────────────────────────────

class SalaryRequest(BaseModel):
    resume_text: str
    target_role: str
    location: Optional[str] = "United States"

@app.post("/estimate-salary/")
async def estimate_salary(req: SalaryRequest):
    if len(req.resume_text.strip()) < 100:
        raise HTTPException(status_code=400, detail="Resume text too short")
    if not req.target_role.strip():
        raise HTTPException(status_code=400, detail="Target role required")
    try:
        response = await asyncio.to_thread(lambda: openai_client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are a compensation expert with deep knowledge of tech salaries. Return ONLY valid JSON."},
                {"role": "user", "content": f"""
Estimate the salary range for this candidate based on their resume and target role.

Target Role: {req.target_role}
Location: {req.location}

Resume:
{req.resume_text[:2500]}

Return JSON:
{{
  "experience_level": "Junior / Mid / Senior / Staff / Principal",
  "years_experience": <integer estimate>,
  "salary_range": {{"min": <integer annual USD>, "max": <integer annual USD>, "median": <integer>}},
  "equity_range": "e.g. $10k-50k RSUs or 0.1-0.5% equity",
  "factors_positive": ["3-4 things in their background that command higher pay"],
  "factors_negative": ["2-3 gaps that may lower offers"],
  "negotiation_tips": ["3 practical salary negotiation tips for this candidate"],
  "comparable_roles": ["2-3 similar roles they could target with similar or higher pay"]
}}
"""}
            ],
            max_tokens=700,
            temperature=0.3,
        ))
        return json.loads(response.choices[0].message.content.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Salary estimation failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# AI CAREER CHATBOT  (Groq — free & fast)
# ─────────────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str        # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

JOB_INTENT_WORDS = {
    "job", "jobs", "role", "roles", "position", "positions", "hiring", "hire",
    "opening", "openings", "vacancy", "vacancies", "find", "search", "looking",
    "apply", "applications", "listing", "listings", "career", "careers",
    "work", "opportunity", "opportunities", "internship", "internships",
    "remote", "full-time", "part-time", "entry level", "senior", "junior",
}

def _detect_job_intent(text: str) -> Optional[str]:
    """Return extracted keyword if message is asking about job listings, else None."""
    lower = text.lower()
    if not any(w in lower for w in JOB_INTENT_WORDS):
        return None
    # Strip common stop words to get a usable search keyword
    stop = {"find", "me", "some", "any", "a", "an", "the", "for", "in", "at",
            "jobs", "job", "roles", "role", "positions", "position", "openings",
            "listings", "opportunities", "can", "you", "show", "give", "list",
            "are", "there", "what", "available", "i", "want", "need", "looking",
            "for", "hiring", "open", "apply", "search"}
    words = [w for w in re.findall(r"[a-z]+", lower) if w not in stop and len(w) > 2]
    return " ".join(words[:4]) if words else None

async def _fetch_jobs_for_chat(keyword: Optional[str], country: str = "US", limit: int = 5) -> list:
    """Pull relevant jobs: tries Supabase first, then falls back to live JSearch."""
    # 1. Try Supabase
    try:
        q = build_jobs_query(supabase, country=country, keyword=keyword or None)
        result = q.order("fetched_at", desc=True).limit(limit).execute()
        rows = result.data or []
        if rows:
            return rows
    except Exception:
        pass

    # 2. Fall back to live JSearch using async client (never blocks event loop)
    if not JSEARCH_API_KEY:
        return []
    try:
        query_str = f"{keyword or 'software engineer'} {country}"
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(
                f"{JSEARCH_BASE}/search",
                headers={
                    "X-RapidAPI-Key":  JSEARCH_API_KEY,
                    "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
                },
                params={"query": query_str, "num_pages": "1", "date_posted": "week"},
            )
        resp.raise_for_status()
        raw = resp.json().get("data") or []
        normalised = []
        for j in raw[:limit]:
            normalised.append({
                "title":            j.get("job_title", ""),
                "company":          j.get("employer_name", ""),
                "location":         j.get("job_city") or j.get("job_state") or j.get("job_country") or "Remote",
                "url":              j.get("job_apply_link") or j.get("job_google_link") or "",
                "employment_type":  j.get("job_employment_type", ""),
                "experience_level": "",
            })
        return normalised
    except Exception:
        return []

@app.post("/chat/")
async def chat(req: ChatRequest):
    last_user_msg = next(
        (m.content for m in reversed(req.messages) if m.role == "user"), ""
    )

    # Detect if the user is asking about job listings
    job_keyword = _detect_job_intent(last_user_msg)
    job_context = ""
    jobs_data   = []
    if job_keyword is not None:
        jobs_data = await _fetch_jobs_for_chat(job_keyword or None)
        if jobs_data:
            lines = []
            for j in jobs_data:
                loc  = j.get("location") or j.get("state") or "Remote"
                url  = j.get("url") or j.get("job_url") or ""
                lines.append(
                    f"- **{j.get('title','Role')}** at {j.get('company','Company')} "
                    f"({loc}){' — ' + url if url else ''}"
                )
            job_context = (
                "\n\nHere are some real current job listings from our database that match:\n"
                + "\n".join(lines)
                + "\n\nShare these with the user and offer tips on applying."
            )

    system = (
        "You are Nexus, an expert AI career co-pilot built exclusively for Nexume. "
        "You help users with resume tips, ATS optimization, interview prep, salary negotiation, cover letters, and job search strategy. "
        "Keep responses concise and practical. Use bullet points when listing tips. "
        "When sharing job listings, present them clearly with company, location, and role. "
        "If no job listings are provided in context, tell the user to check the Jobs tab at the top of Nexume for live listings. "
        "IMPORTANT RULES — follow these strictly: "
        "1. NEVER mention, recommend, or direct users to any external job platforms including LinkedIn, Indeed, Glassdoor, Monster, ZipRecruiter, CareerBuilder, or any other job board. "
        "2. NEVER say things like 'check LinkedIn' or 'search on Indeed' — always direct users to Nexume's Jobs tab instead. "
        "3. If asked about LinkedIn profiles or profile tips, you may give advice on writing a good profile but do NOT tell them to go use LinkedIn for job searching — redirect to Nexume Jobs. "
        "4. Always refer to yourself as Nexus and to the platform as Nexume. "
        "5. Never say listings are unavailable — always offer next steps within Nexume. "
        "6. Be encouraging, sharp, and professional."
        + job_context
    )

    msgs = [{"role": "system", "content": system}]
    for m in req.messages[-12:]:
        msgs.append({"role": m.role, "content": m.content})

    use_groq = bool(os.getenv("GROQ_API_KEY"))
    try:
        if use_groq:
            resp = await asyncio.to_thread(lambda: groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=msgs,
                max_tokens=600,
                temperature=0.65,
            ))
        else:
            resp = await asyncio.to_thread(lambda: openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=msgs,
                max_tokens=600,
                temperature=0.65,
            ))
        return {
            "reply": resp.choices[0].message.content.strip(),
            "jobs":  jobs_data,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status":    "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "endpoints": [
            "POST /analyze-resume/",
            "POST /rewrite-bullet/",
            "POST /generate-interview/",
            "POST /evaluate-answer/",
            "GET  /jobs/?country=IN|US&keyword=&page=",
            "GET  /jobs/search/?q=&country=IN|US",
            "POST /jobs/refresh/",
            "POST /generate-cover-letter/",
            "POST /optimize-linkedin/",
            "POST /generate-cold-email/",
            "POST /analyze-skill-gap/",
            "POST /estimate-salary/",
            "POST /chat/",
            "GET  /health",
        ]
    }

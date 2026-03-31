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

@app.on_event("startup")
async def startup_event():
    # Refresh every 8 hours — tune to match your JSearch plan:
    #   Free: 500 req/mo → set hours=24
    #   Basic ($10): 3000 req/mo → set hours=8
    #   Pro ($30): 20000 req/mo → set hours=2
    # scheduler.add_job(refresh_all_jobs, "interval", hours=8, id="job_refresh")
    # scheduler.start()
    # asyncio.create_task(refresh_all_jobs())  # disabled: JSearch quota exceeded
    print("[Startup] Job refresh disabled (JSearch quota exceeded).")

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


@app.get("/jobs/")
async def get_jobs(
    country:          str           = Query("US"),
    keyword:          Optional[str] = Query(None),
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
        return {
            "jobs":    jobs,
            "page":    page,
            "country": country.upper(),
            "count":   len(jobs),
            "has_more": len(jobs) == per_page,
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


# ─────────────────────────────────────────────────────────────────────────────
# ROUTES — INTERVIEW PREP
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/generate-interview/", response_model=InterviewResponse)
async def generate_interview(req: InterviewRequest):
    if not req.job_description or len(req.job_description.strip()) < 50:
        raise HTTPException(status_code=400, detail="Job description too short")

    resume_context = f"\nCandidate Resume:\n{req.resume_text[:3000]}" if req.resume_text and req.resume_text.strip() else ""

    try:
        response = openai_client.chat.completions.create(
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
        )
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
        response = openai_client.chat.completions.create(
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
        )
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

    try:
        text = extract_text_from_pdf(contents)
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
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

    job_description = sanitize_text(job_description or "")
    ats_score, ats_breakdown = calculate_ats_score(text, job_description)
    weak_bullets = extract_weak_bullets(text)
    jd_match     = analyze_jd_match(text, job_description) if job_description and job_description.strip() else None

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
        response = openai_client.chat.completions.create(
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
        )
        out = json.loads(response.choices[0].message.content.strip())
        out["ats_score"]     = ats_score
        out["ats_breakdown"] = ats_breakdown
        out["weak_bullets"]  = weak_bullets
        out["jd_match"]      = jd_match
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Model returned invalid JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {str(e)}")

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
        response = openai_client.chat.completions.create(
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
        )
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
        response = openai_client.chat.completions.create(
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
        )
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
        response = openai_client.chat.completions.create(
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
        )
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
        response = openai_client.chat.completions.create(
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
        )
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
        response = openai_client.chat.completions.create(
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
        )
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
        response = openai_client.chat.completions.create(
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
        )
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

def _fetch_jobs_for_chat(keyword: Optional[str], country: str = "US", limit: int = 5) -> list:
    """Pull relevant jobs from Supabase for chat context."""
    try:
        q = build_jobs_query(supabase, country=country, keyword=keyword or None)
        result = q.order("fetched_at", desc=True).limit(limit).execute()
        return result.data or []
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
        jobs_data = _fetch_jobs_for_chat(job_keyword or None)
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
        "You are Nexus, a friendly expert career co-pilot for LandTheRole.ai. "
        "You help job seekers with resume tips, ATS optimization, interview prep, "
        "salary negotiation, LinkedIn profiles, cover letters, and job search strategy. "
        "Keep responses concise and practical. Use bullet points when listing tips. "
        "When sharing job listings, present them clearly with company and location. "
        "Always refer to yourself as Nexus."
        + job_context
    )

    msgs = [{"role": "system", "content": system}]
    for m in req.messages[-12:]:
        msgs.append({"role": m.role, "content": m.content})

    use_groq = bool(os.getenv("GROQ_API_KEY"))
    try:
        if use_groq:
            resp = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=msgs,
                max_tokens=600,
                temperature=0.65,
            )
        else:
            resp = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=msgs,
                max_tokens=600,
                temperature=0.65,
            )
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

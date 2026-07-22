<div align="center">

# ✦ Nexume

### AI-powered career co-pilot — from resume to offer letter

[**Live site →**](https://nexume-ai.vercel.app/)

A dark, futuristic, voice-enabled career platform that combines AI resume analysis, real-time job aggregation from public ATS boards, strict role-matched job discovery across 55 majors and 1,900+ roles, and a fully conversational AI mock-interview simulator.

</div>

---

## What it does

Nexume is a single dashboard that takes you from "I need a job" to "I got the offer":

- **📄 Resume Analyzer** — Upload a PDF, get an instant ATS score, keyword-gap analysis against any JD, AI-rewritten weak bullets, and a downloadable report
- **🎯 AI Job Marketplace** — Real jobs auto-fetched every 5 minutes from Greenhouse, Lever, Ashby, and Workable boards. Pick from 55 academic majors → see all 100+ role variations for your field → strict relevance matching filters out unrelated postings (no "Frontend Engineer" → solutions architect noise)
- **🎙️ Live Voice Mock Interviews** — Real-time AI interviewer that listens via your microphone, responds with OpenAI's TTS voices, asks dynamic follow-ups based on your answers. Five modes (HR / Behavioral / Technical / Case Study / Stress). Generates a post-interview scorecard with strengths, weaknesses, and "what to say instead" rewrites
- **✉️ Cover Letter Generator** — Tailored letters in seconds, four tone presets
- **📌 Application Tracker** — Notion-style table for every application from "Applied" through "Offer"
- **⚡ AI Tools Suite** — LinkedIn optimizer, cold-email writer, skill-gap analyzer, salary estimator
- **🤖 Nexus AI Chat** — Floating co-pilot for ad-hoc career questions

## Live demo

🌐 **https://nexume-ai.vercel.app/**

Try it on **Chrome** for the voice interview feature (uses Web Speech API for microphone input).

---

## Tech stack

**Frontend**
- React 19 + Vite 7
- Pure CSS design system (no framework) — Inter Tight + JetBrains Mono, dark-purple/violet aesthetic with glassmorphism, mesh gradients, cursor-following glow
- Framer Motion / Lucide / GSAP (installed for future use)
- Deployed on **Vercel** with strict CSP + security headers

**Backend**
- Python 3.11 + FastAPI + Uvicorn
- OpenAI Python SDK (`gpt-4o-mini` for conversation, `tts-1` for voice)
- APScheduler for cron-based job ingestion
- Supabase Python client for DB access
- Deployed on **Render** (free tier — cold-starts on first request)

**Data**
- **Supabase Postgres** — `jobs`, `ingestion_runs` tables with row-level security
- Public ATS adapters: Greenhouse / Lever / Ashby / Workable boards (~90 companies seeded)
- Legacy aggregator: JSearch (RapidAPI) for broader coverage

**Security**
- Per-IP sliding-window rate limiter (LLM 10/min, TTS 30/min, reads 120/min)
- CORS lockdown + Vercel CSP + HSTS + X-Frame-Options DENY + Permissions-Policy
- Admin token auto-derived from `SUPABASE_KEY` for `/jobs/refresh/` and `/jobs/ingest-ats`
- PDF magic-byte validation on resume upload
- See [`SECURITY.md`](SECURITY.md) for the full threat model

---

## Architecture

```
                 ┌──────────────────────┐
   Vercel CDN ──▶│  React SPA           │
   (edge CSP)    │  src/                │
                 │  ├─ components/      │  ◀── Browser STT (Web Speech)
                 │  ├─ data/majors.js   │       55 majors × 1937 roles
                 │  ├─ data/sectors.js  │
                 │  └─ lib/             │
                 │     ├─ roleMatcher   │  ◀── Strict include/exclude
                 │     ├─ search        │       per role family
                 │     └─ format        │
                 └──────────┬───────────┘
                            │ HTTPS
                            ▼
                 ┌──────────────────────┐
                 │  FastAPI on Render   │
                 │  backend/            │
                 │  ├─ main.py          │  ◀── Rate-limit + admin guard
                 │  ├─ security.py      │       per-route dependencies
                 │  ├─ jobs.py          │
                 │  └─ aggregators/     │
                 │     ├─ greenhouse    │  ◀── 5-min cron
                 │     ├─ lever         │       tier1 every 5min
                 │     ├─ ashby         │       tier2 every 30min
                 │     ├─ workable      │       tier3 every 6h
                 │     └─ pipeline      │
                 └──────┬──────┬────────┘
                        ▼      ▼
              ┌─────────────┐  ┌─────────────┐
              │  Supabase   │  │  OpenAI API │
              │  Postgres   │  │  gpt-4o-mini│
              │  + RLS      │  │  + tts-1    │
              └─────────────┘  └─────────────┘
```

---

## Running locally

### Prerequisites
- Node 20+
- Python 3.11+
- An OpenAI API key
- A Supabase project (free tier works)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create backend/.env
cat > .env <<'EOF'
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_KEY=eyJ...    # service_role key
JSEARCH_API_KEY=...    # optional, for legacy aggregator
# NEXUME_ADMIN_TOKEN=...  # optional; auto-derived from SUPABASE_KEY if unset
EOF

# Run the Supabase schema (once)
# Paste backend/supabase_schema.sql into Supabase → SQL Editor → Run

uvicorn main:app --reload --port 8000
```

#### Backend tests

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

The ~180-test suite runs fully offline and covers: the security
primitives (PDF validation, per-IP rate limiting end to end, admin
auth), the ATS scoring engine and JD matching, every AI endpoint
(interview generation/evaluation, the voice interview turn engine,
cover letters, cold email, skill gap, salary) against a faked OpenAI
client, the job aggregators and both ingestion pipelines against faked
HTTP and Supabase, the /jobs listing with its graceful offline
fallback, and the waitlist's file fallback. It runs in CI on every
backend change.

### Frontend

```bash
cd backend/frontend/frontend
npm install
```

#### Frontend tests

```bash
cd backend/frontend/frontend
npm test              # Vitest + Testing Library (~160 tests)
npm run test:coverage # with a V8 coverage report
```

The suite covers the lib layer (search expansion, role matching,
formatters, retry/backoff, saved-jobs and tracker stores), the data
taxonomies, and component behavior — the pickers, job cards and saved
view, pagination, the status bar (including the admin panel), and the
interview setup and progress screens. It runs in CI on every frontend
change.

```bash

# Point at your local backend if you want
# (default points at production: https://landtherole-ai.onrender.com)
# Edit the API constant in src/components/JobsTab.jsx + InterviewSimulator.jsx

npm run dev
# → http://localhost:5173
```

### Seed the database with real jobs

```bash
# Generate the admin token (derived from SUPABASE_KEY)
TOKEN=$(python3 -c "
import hashlib, os
from pathlib import Path
env = dict(line.strip().split('=', 1) for line in Path('backend/.env').read_text().splitlines() if '=' in line)
print(hashlib.sha256(f'nexume-admin-v1:{env[\"SUPABASE_KEY\"]}'.encode()).hexdigest())
")

# Trigger first ingestion — pulls ~30 companies × ~30 jobs in parallel
curl -X POST "http://localhost:8000/jobs/ingest-ats?tier=tier1" \
  -H "X-Admin-Token: $TOKEN"

# Check progress
curl http://localhost:8000/jobs/stats
```

---

## What's working today

| Feature | Status |
|---|---|
| Dark-purple cinematic redesign across every tab | ✅ Live |
| 55 academic majors with 1,937 curated role types | ✅ Live |
| Real-time job aggregation (Greenhouse / Lever / Ashby / Workable) | ✅ Live, auto-fetches every 5 min |
| Strict role matching (25 role families with include/exclude/skills) | ✅ Live |
| Voice mock interviewer (5 modes, 6 OpenAI voices + browser fallback) | ✅ Live |
| Mode-aware silence detection + filler-word handling | ✅ Live |
| Sentence-pipelined TTS (first word in ~0.8 s vs ~2.5 s) | ✅ Live |
| Interrupt button to stop the AI mid-sentence | ✅ Live |
| ATS resume analysis with bullet rewriter | ✅ Live |
| Cover letter generator | ✅ Live |
| Application tracker | ✅ Live |
| LinkedIn / cold-email / skill-gap / salary tools | ✅ Live |
| Live job count + "posted today" badge + admin status panel | ✅ Live |
| Security baseline (CORS, rate limit, admin guard, CSP, HSTS) | ✅ Live |

## What's intentionally NOT built yet

- **User authentication** — currently everything (resume history, saved jobs, tracker) is browser `localStorage`. Adding Supabase Auth is the next major milestone before public launch.
- **Email job alerts** — needs auth first
- **Payments / Pro tier** — author is an international student, monetization deferred to December 2026
- **LinkedIn / Indeed scraping** — legal / proxy infrastructure required
- **Avatar with lip sync** — would need Tavus or HeyGen ($300+/mo)
- **Sub-500ms voice latency** — would need OpenAI Realtime API ($0.30/min)

See [`SECURITY.md`](SECURITY.md) for the prioritized roadmap.

---

## Project structure

```
nexume-ai/
├── README.md
├── SECURITY.md
├── .gitignore
└── backend/
    ├── main.py                  # FastAPI app + routes
    ├── jobs.py                  # Legacy JSearch aggregator + query builder
    ├── security.py              # Rate limit, admin guard, headers
    ├── supabase_schema.sql      # Postgres schema migration
    ├── requirements.txt
    ├── aggregators/             # Public ATS adapters
    │   ├── greenhouse.py
    │   ├── lever.py
    │   ├── ashby.py
    │   ├── workable.py
    │   ├── companies.py         # ~90 company registry
    │   └── pipeline.py          # Concurrent orchestrator
    └── frontend/frontend/
        ├── index.html
        ├── vercel.json          # Edge headers + CSP
        ├── package.json
        └── src/
            ├── App.jsx
            ├── App.css          # Full design system
            ├── components/
            │   ├── BackgroundFX.jsx
            │   ├── JobsTab.jsx
            │   ├── JobsStatusBar.jsx
            │   └── InterviewSimulator.jsx
            ├── data/
            │   ├── majors.js    # 55 majors × 1937 roles
            │   ├── sectors.js   # 112 sector taxonomy
            │   └── locations.js
            ├── hooks/
            │   └── useSavedJobs.js
            └── lib/
                ├── roleMatcher.js   # Strict relevance scoring
                ├── search.js        # SWE/PM/ML expansion + typo fix
                └── format.js        # Rounded counts, time-ago
```

---

## About this project

Nexume is a solo personal project by **[Bargavi Sivaraman](https://github.com/Bargavisivaraman)** — international student, current build phase, monetization deferred until December 2026 for visa reasons.

The codebase exists because traditional job platforms are fragmented (LinkedIn for jobs, Notion for tracking, ChatGPT for prep, separate tools for cover letters), and an AI-native one-stop dashboard felt obviously better.

Built incrementally in 2026 with AI pair-programming (Claude). Every commit log is honest about scope, deferrals, and trade-offs. The features list reflects what actually works, not what was planned.

## Acknowledgments

- **Greenhouse, Lever, Ashby, Workable** — for offering public job-board APIs that don't require auth
- **Supabase** — Postgres + Auth (eventually) + free tier
- **OpenAI** — `gpt-4o-mini` for conversation, `tts-1` for voice
- **Render + Vercel** — free hosting that actually scales
- **The candidate experience** — for being the inspiration to build something better

## License

This is a personal project, currently unlicensed (all rights reserved by the author). If you want to use any of the code commercially, reach out first.

---

<div align="center">

**Built by Bargavi Sivaraman · 2026**

[Live site](https://nexume-ai.vercel.app/) · [Report an issue](https://github.com/Bargavisivaraman/nexume-ai/issues)

</div>

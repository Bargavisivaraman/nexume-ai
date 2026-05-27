"""
Pipeline orchestrator — pulls jobs from all configured ATSes, dedupes, and
upserts to Supabase.

Usage from main.py:

    from aggregators import run_ats_ingestion
    asyncio.create_task(run_ats_ingestion(supabase, tier="tier1"))

Or call /jobs/ingest-ats?tier=tier1 to trigger manually.
"""

import asyncio
import uuid
from datetime import datetime, timezone

import httpx
from supabase import Client

from .companies import COMPANIES, list_companies_by_tier
from .greenhouse import fetch_greenhouse
from .lever import fetch_lever
from .ashby import fetch_ashby
from .workable import fetch_workable


# Map ats → fetcher
FETCHERS = {
    "greenhouse": fetch_greenhouse,
    "lever":      fetch_lever,
    "ashby":      fetch_ashby,
    "workable":   fetch_workable,
}


async def _fetch_one(http: httpx.AsyncClient, company: dict) -> list[dict]:
    """Fetch one company's jobs via the right ATS adapter; tag with industry."""
    fetcher = FETCHERS.get(company["ats"])
    if not fetcher:
        return []
    rows = await fetcher(http, company["slug"], company["name"])
    # Industry tagging happens here (the adapter left it null)
    # We use the company's industry hint as a default; refine per-title later
    from jobs import classify_industry
    for r in rows:
        r["industry"] = r.get("industry") or classify_industry(r["title"]) or company.get("industry", "Other")
    return rows


async def run_ats_ingestion(
    supabase: Client,
    *,
    tier: str | None = None,
    max_concurrent: int = 6,
) -> dict:
    """
    Concurrent fetch across all (or one tier's) companies, then upsert.

    Returns stats dict: {fetched, inserted, errors, companies_run}.
    """
    targets = list_companies_by_tier(tier) if tier else COMPANIES
    if not targets:
        return {"fetched": 0, "inserted": 0, "errors": 0, "companies_run": 0}

    run_id = str(uuid.uuid4())
    stats = {"fetched": 0, "inserted": 0, "errors": 0, "companies_run": 0}
    start = datetime.now(timezone.utc)

    print(f"[ATS Ingest] {run_id} starting — {len(targets)} companies (tier={tier or 'all'})")

    sem = asyncio.Semaphore(max_concurrent)

    async with httpx.AsyncClient(headers={"User-Agent": "NexumeBot/1.0 (+https://nexume-ai.vercel.app)"}) as http:
        async def worker(company: dict):
            async with sem:
                try:
                    rows = await _fetch_one(http, company)
                    return company, rows
                except Exception as e:
                    print(f"[ATS Ingest] {company['name']}: {e}")
                    return company, []

        results = await asyncio.gather(*[worker(c) for c in targets])

    # Aggregate + dedupe across companies by job_id
    seen_ids = set()
    all_rows: list[dict] = []
    for company, rows in results:
        stats["companies_run"] += 1
        if not rows:
            continue
        for r in rows:
            jid = r.get("job_id")
            if jid and jid not in seen_ids:
                seen_ids.add(jid)
                all_rows.append(r)
        stats["fetched"] += len(rows)

    # Upsert in chunks (Supabase has request-size limits)
    CHUNK = 200
    for i in range(0, len(all_rows), CHUNK):
        chunk = all_rows[i : i + CHUNK]
        try:
            supabase.table("jobs").upsert(chunk, on_conflict="job_id").execute()
            stats["inserted"] += len(chunk)
        except Exception as e:
            print(f"[ATS Ingest] DB upsert error on chunk {i}: {e}")
            stats["errors"] += len(chunk)

    elapsed = (datetime.now(timezone.utc) - start).seconds
    print(f"[ATS Ingest] {run_id} done in {elapsed}s — {stats}")

    # Log to ingestion_runs (best-effort)
    try:
        supabase.table("ingestion_runs").insert({
            "run_id":       run_id,
            "country":      "ATS",
            "queries_run":  stats["companies_run"],
            "fetched":      stats["fetched"],
            "inserted":     stats["inserted"],
            "skipped":      0,
            "errors":       stats["errors"],
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        print(f"[ATS Ingest] Failed to log run: {e}")

    return stats

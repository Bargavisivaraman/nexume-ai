"""
Pipeline orchestrator — pulls jobs from all configured ATSes, dedupes, and
upserts to Supabase.

Usage from main.py:

    from aggregators import run_ats_ingestion
    asyncio.create_task(run_ats_ingestion(supabase, tier="tier1"))

Or call /jobs/ingest-ats?tier=tier1 to trigger manually.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

import httpx

if TYPE_CHECKING:
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


def dedupe_rows_by_job_id(
    results: list[tuple[dict, list[dict]]],
) -> tuple[list[dict], int]:
    """Flatten per-company fetch results into a single list, dropping rows whose
    job_id was already seen (and rows without a job_id).

    Returns ``(unique_rows, total_fetched)`` where total_fetched counts every
    fetched row including duplicates.
    """
    seen_ids: set = set()
    unique_rows: list[dict] = []
    total_fetched = 0
    for _company, rows in results:
        if not rows:
            continue
        total_fetched += len(rows)
        for r in rows:
            jid = r.get("job_id")
            if jid and jid not in seen_ids:
                seen_ids.add(jid)
                unique_rows.append(r)
    return unique_rows, total_fetched


async def _fetch_one(http: httpx.AsyncClient, company: dict) -> list[dict]:
    """Fetch one company's jobs via the right ATS adapter; tag with industry."""
    fetcher = FETCHERS.get(company["ats"])
    if not fetcher:
        return []
    rows = await fetcher(http, company["slug"], company["name"])
    # Industry tagging happens here (the adapter left it null).
    # classify_industry always returns a string ("Other" when unsure), so the
    # company's industry hint must step in exactly when the title classifier
    # punted — not never.
    from jobs import classify_industry
    for r in rows:
        if not r.get("industry"):
            ind = classify_industry(r["title"])
            if ind == "Other":
                ind = company.get("industry") or "Other"
            r["industry"] = ind
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
    stats["companies_run"] = len(results)
    all_rows, stats["fetched"] = dedupe_rows_by_job_id(results)

    # Preserve fetched_at on rows the DB already holds. Every tier1 run
    # re-upserts the whole corpus; letting each upsert stamp a fresh
    # fetched_at made "new_in_last_hour" count ~everything and reshuffled the
    # /jobs/ sort order (fetched_at desc) between page requests. Only rows
    # that are actually new keep their just-generated timestamp; every other
    # column still gets replaced by the upsert.
    CHUNK = 200
    existing_fetched_at: dict[str, str] = {}
    all_ids = [r["job_id"] for r in all_rows]
    for i in range(0, len(all_ids), CHUNK):
        id_chunk = all_ids[i : i + CHUNK]
        try:
            res = await asyncio.to_thread(
                lambda ids=id_chunk: supabase.table("jobs")
                .select("job_id,fetched_at").in_("job_id", ids).execute()
            )
            for row in (res.data or []):
                if row.get("job_id") and row.get("fetched_at"):
                    existing_fetched_at[row["job_id"]] = row["fetched_at"]
        except Exception as e:
            # Lookup failure is non-fatal — worst case those rows get a fresh
            # fetched_at, which is the old (pre-fix) behaviour.
            print(f"[ATS Ingest] fetched_at lookup failed on chunk {i}: {e}")
    for r in all_rows:
        prior = existing_fetched_at.get(r["job_id"])
        if prior:
            r["fetched_at"] = prior

    # Upsert in chunks (Supabase has request-size limits).
    # The supabase client is synchronous — run each upsert in a thread so it
    # never blocks the event loop. Before this, a boot-time ingestion froze
    # every in-flight user request (/jobs/, /jobs/stats hung for the whole
    # upsert phase) because the loop couldn't schedule anything else.
    for i in range(0, len(all_rows), CHUNK):
        chunk = all_rows[i : i + CHUNK]
        try:
            await asyncio.to_thread(
                lambda c=chunk: supabase.table("jobs").upsert(c, on_conflict="job_id").execute()
            )
            stats["inserted"] += len(chunk)
        except Exception as e:
            print(f"[ATS Ingest] DB upsert error on chunk {i}: {e}")
            stats["errors"] += len(chunk)

    elapsed = (datetime.now(timezone.utc) - start).seconds
    print(f"[ATS Ingest] {run_id} done in {elapsed}s — {stats}")

    # Log to ingestion_runs (best-effort; threaded for the same reason as above)
    try:
        row = {
            "run_id":       run_id,
            "country":      "ATS",
            "queries_run":  stats["companies_run"],
            "fetched":      stats["fetched"],
            "inserted":     stats["inserted"],
            "skipped":      0,
            "errors":       stats["errors"],
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        await asyncio.to_thread(
            lambda: supabase.table("ingestion_runs").insert(row).execute()
        )
    except Exception as e:
        print(f"[ATS Ingest] Failed to log run: {e}")

    return stats

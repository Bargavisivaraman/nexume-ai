"""Ashby public job-board adapter.

Endpoint:  https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true
No auth required.

Ashby is fast-growing among newer/AI startups: Linear, Vercel, Posthog, Tessl,
Anthropic (some roles), Modal, Browserbase, Pinecone, etc.
"""

import html
import re
from typing import Optional
import httpx

from .common import (
    detect_experience_level, detect_internship, detect_new_grad,
    detect_work_mode, detect_job_type, extract_tech_stack,
    compute_dedupe_hash, truncate, now_utc_iso,
)

ASHBY_BASE = "https://api.ashbyhq.com/posting-api/job-board"

_HTML_TAGS = re.compile(r"<[^>]+>")


def _strip_html(s: Optional[str]) -> str:
    if not s: return ""
    return html.unescape(_HTML_TAGS.sub(" ", s)).strip()


async def fetch_ashby(
    http: httpx.AsyncClient,
    slug: str,
    company_name: str,
    *,
    country: str = "US",
) -> list[dict]:
    """Fetch all open postings for one Ashby-hosted company."""
    try:
        resp = await http.get(
            f"{ASHBY_BASE}/{slug}",
            params={"includeCompensation": "true"},
            timeout=20.0,
        )
        if resp.status_code != 200:
            return []
        data = resp.json() or {}
        items = data.get("jobs") or []
    except Exception as e:
        print(f"[Ashby] {slug}: {e}")
        return []

    rows: list[dict] = []
    for j in items:
        post_id = j.get("id")
        if not post_id: continue
        job_id = f"ashby_{slug}_{post_id}"

        title = (j.get("title") or "").strip()
        if not title:
            continue

        loc_str = (j.get("location") or "").strip() or None
        description_html = j.get("descriptionHtml") or j.get("description") or ""
        description = _strip_html(description_html)

        work_mode, is_remote = detect_work_mode(title, description, loc_str or "")
        # Ashby explicit signal: isRemote / workplaceType
        if j.get("isRemote") is True:
            is_remote = True
            work_mode = "Remote"
        if (j.get("workplaceType") or "").lower() == "hybrid":
            work_mode = "Hybrid"
            is_remote = False

        job_type = detect_job_type(title, description)
        experience = detect_experience_level(title, description)
        is_intern = detect_internship(title, description)
        is_new_grad = detect_new_grad(title, description)

        # Compensation block: a list of currency-aware tiers
        sal_min, sal_max, sal_period, currency = (None, None, None, None)
        comp = j.get("compensation") or {}
        tiers = comp.get("compensationTierSummary") if isinstance(comp, dict) else None
        if isinstance(tiers, list) and tiers:
            t = tiers[0]
            if isinstance(t, dict):
                sal_min = t.get("minValue")
                sal_max = t.get("maxValue")
                currency = t.get("currencyCode")
                interval = (t.get("interval") or "").lower()
                sal_period = "hour" if "hour" in interval else "year"

        apply_url = j.get("jobUrl") or j.get("applyUrl") or ""

        city, state = None, None
        if loc_str and "," in loc_str:
            parts = [p.strip() for p in loc_str.split(",")]
            city = parts[0] or None
            state = parts[1] if len(parts) > 1 else None
        elif loc_str:
            city = loc_str

        tech_stack = extract_tech_stack(description)

        rows.append({
            "job_id":           job_id,
            "title":            title,
            "company":          company_name,
            "location":         loc_str,
            "city":             city,
            "state":            state,
            "country":          country,
            "is_remote":        is_remote,
            "work_mode":        work_mode,
            "industry":         None,
            "experience_level": experience,
            "job_type":         job_type,
            "is_internship":    is_intern,
            "is_new_grad":      is_new_grad,
            "salary_min":       sal_min,
            "salary_max":       sal_max,
            "salary_currency":  currency or ("USD" if (sal_min or sal_max) else None),
            "salary_period":    sal_period,
            "description":      truncate(description, 3000),
            "url":              apply_url or None,
            "source_name":      "Ashby",
            "tech_stack":       tech_stack or None,
            "posted_at":        j.get("publishedAt"),
            "fetched_at":       now_utc_iso(),
            "hash_dedupe":      compute_dedupe_hash(title, company_name, loc_str or ""),
            "is_active":        True,
        })

    return rows

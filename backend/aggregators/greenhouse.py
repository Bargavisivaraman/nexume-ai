"""Greenhouse public job-board adapter.

Endpoint:  https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
No auth required. Returns full descriptions when content=true.

Greenhouse hosts ~6,000 companies including Stripe, Airbnb, Coinbase, Discord,
Notion, Figma, OpenAI, Anthropic, Brex, Ramp, Mercury, etc.
"""

import html
import re
from typing import Optional
import httpx

from .common import (
    detect_experience_level, detect_internship, detect_new_grad,
    detect_work_mode, detect_job_type, extract_tech_stack,
    parse_salary, compute_dedupe_hash, truncate, now_utc_iso,
)

GREENHOUSE_BASE = "https://boards-api.greenhouse.io/v1"

_HTML_TAGS = re.compile(r"<[^>]+>")


def _strip_html(s: Optional[str]) -> str:
    if not s: return ""
    return html.unescape(_HTML_TAGS.sub(" ", s)).strip()


async def fetch_greenhouse(
    http: httpx.AsyncClient,
    slug: str,
    company_name: str,
    *,
    country: str = "US",
) -> list[dict]:
    """Fetch all open jobs for one Greenhouse-hosted company. Returns normalized rows."""
    try:
        resp = await http.get(
            f"{GREENHOUSE_BASE}/boards/{slug}/jobs",
            params={"content": "true"},
            timeout=20.0,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        items = data.get("jobs") or []
    except Exception as e:
        print(f"[Greenhouse] {slug}: {e}")
        return []

    rows: list[dict] = []
    for j in items:
        job_id = f"gh_{slug}_{j.get('id')}"
        title  = (j.get("title") or "").strip()
        if not title:
            continue

        location_obj = j.get("location") or {}
        loc_str = (location_obj.get("name") or "").strip()

        description_html = j.get("content") or ""
        description = _strip_html(description_html)

        work_mode, is_remote = detect_work_mode(title, description, loc_str)
        job_type = detect_job_type(title, description)
        experience = detect_experience_level(title, description)
        is_intern = detect_internship(title, description)
        is_new_grad = detect_new_grad(title, description)

        # Greenhouse often has metadata blocks for compensation
        sal_min, sal_max, sal_period = (None, None, None)
        metadata = j.get("metadata") or []
        for m in metadata:
            if not isinstance(m, dict): continue
            name = (m.get("name") or "").lower()
            val  = m.get("value")
            if name and "salary" in name and isinstance(val, str):
                a, b, p = parse_salary(val)
                if a: sal_min, sal_max, sal_period = a, b, p
                break

        if sal_min is None:
            # try parsing first 600 chars of description for a salary range
            sal_min, sal_max, sal_period = parse_salary(description[:600])

        apply_url = j.get("absolute_url") or ""

        # city/state best-effort split
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
            "location":         loc_str or None,
            "city":             city,
            "state":            state,
            "country":          country,
            "is_remote":        is_remote,
            "work_mode":        work_mode,
            "industry":         None,  # filled by classify_industry() upstream
            "experience_level": experience,
            "job_type":         job_type,
            "is_internship":    is_intern,
            "is_new_grad":      is_new_grad,
            "salary_min":       sal_min,
            "salary_max":       sal_max,
            "salary_currency":  "USD" if (sal_min or sal_max) else None,
            "salary_period":    sal_period,
            "description":      truncate(description, 3000),
            "url":              apply_url or None,
            "source_name":      "Greenhouse",
            "tech_stack":       tech_stack or None,
            "posted_at":        j.get("updated_at"),
            "fetched_at":       now_utc_iso(),
            "hash_dedupe":      compute_dedupe_hash(title, company_name, loc_str),
            "is_active":        True,
        })

    return rows

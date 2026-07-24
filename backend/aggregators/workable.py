"""Workable public job adapter.

Endpoint:  https://apply.workable.com/api/v3/accounts/{slug}/jobs
No auth required.

Workable hosts ~30,000 small/mid companies across many industries — broader
coverage than Greenhouse/Lever which skew tech.
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

WORKABLE_BASE = "https://apply.workable.com/api/v3/accounts"

_HTML_TAGS = re.compile(r"<[^>]+>")


def _strip_html(s: Optional[str]) -> str:
    if not s: return ""
    return html.unescape(_HTML_TAGS.sub(" ", s)).strip()


async def fetch_workable(
    http: httpx.AsyncClient,
    slug: str,
    company_name: str,
    *,
    country: str = "US",
    limit: int = 50,
) -> list[dict]:
    """Fetch open jobs for one Workable-hosted company."""
    try:
        resp = await http.get(
            f"{WORKABLE_BASE}/{slug}/jobs",
            params={"state": "published", "limit": str(limit)},
            timeout=20.0,
        )
        if resp.status_code != 200:
            return []
        data = resp.json() or {}
        items = data.get("results") or []
    except Exception as e:
        print(f"[Workable] {slug}: {e}")
        return []

    rows: list[dict] = []
    for j in items:
        shortcode = j.get("shortcode") or ""
        if not shortcode: continue
        job_id = f"workable_{slug}_{shortcode}"

        title = (j.get("title") or "").strip()
        if not title:
            continue

        loc = j.get("location") or {}
        city = (loc.get("city") or "").strip() or None
        region = (loc.get("region") or "").strip() or None
        ctry = (loc.get("country") or "").strip() or None
        loc_str = ", ".join(filter(None, [city, region, ctry])) or None

        description = _strip_html(j.get("description") or "")
        requirements = _strip_html(j.get("requirements") or "")
        full_desc = (description + "\n\n" + requirements).strip()

        work_mode, is_remote = detect_work_mode(title, full_desc, loc_str or "")
        if loc.get("workplace") == "remote":
            work_mode = "Remote"; is_remote = True
        elif loc.get("workplace") == "hybrid":
            work_mode = "Hybrid"; is_remote = False

        emp_type = j.get("employment_type") or ""
        job_type = {
            "full-time": "Full-time", "part-time": "Part-time",
            "contract": "Contract", "internship": "Internship", "temporary": "Contract",
        }.get(emp_type.lower(), detect_job_type(title, full_desc))

        experience = detect_experience_level(title, full_desc)
        is_intern = detect_internship(title, full_desc) or emp_type.lower() == "internship"
        is_new_grad = detect_new_grad(title, full_desc)

        sal_min, sal_max, sal_period = parse_salary(full_desc[:600])

        apply_url = j.get("application_url") or j.get("shortlink") or ""

        tech_stack = extract_tech_stack(full_desc)

        rows.append({
            "job_id":           job_id,
            "title":            title,
            "company":          company_name,
            "location":         loc_str,
            "city":             city,
            "state":            region,
            "country":          (ctry or country)[:2].upper() if ctry else country,
            "is_remote":        is_remote,
            "work_mode":        work_mode,
            "industry":         None,
            "experience_level": experience,
            "job_type":         job_type,
            "is_internship":    is_intern,
            "is_new_grad":      is_new_grad,
            "salary_min":       sal_min,
            "salary_max":       sal_max,
            "salary_currency":  "USD" if (sal_min or sal_max) else None,
            "salary_period":    sal_period,
            "description":      truncate(full_desc, 3000),
            "url":              apply_url or None,
            "source_name":      "Workable",
            "tech_stack":       tech_stack or None,
            "posted_at":        j.get("published_on"),
            "fetched_at":       now_utc_iso(),
            "hash_dedupe":      compute_dedupe_hash(title, company_name, loc_str or ""),
            "is_active":        True,
        })

    return rows

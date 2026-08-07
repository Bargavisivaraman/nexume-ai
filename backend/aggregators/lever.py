"""Lever public posting adapter.

Endpoint:  https://api.lever.co/v0/postings/{slug}?mode=json
No auth required.

Lever hosts ~3,000 companies including Netflix (some teams), Github, Square,
Asana, Lyft, Eventbrite, Postman, KeepTruckin, Affirm, etc.
"""

from typing import Optional
import httpx

from .common import (
    detect_experience_level, detect_internship, detect_new_grad,
    detect_work_mode, detect_job_type, extract_tech_stack,
    parse_salary, compute_dedupe_hash, truncate, now_utc_iso,
)

LEVER_BASE = "https://api.lever.co/v0/postings"


async def fetch_lever(
    http: httpx.AsyncClient,
    slug: str,
    company_name: str,
    *,
    country: str = "US",
) -> list[dict]:
    """Fetch all postings for one Lever-hosted company."""
    try:
        resp = await http.get(
            f"{LEVER_BASE}/{slug}",
            params={"mode": "json"},
            timeout=20.0,
        )
        if resp.status_code != 200:
            return []
        items = resp.json() or []
    except Exception as e:
        print(f"[Lever] {slug}: {e}")
        return []

    rows: list[dict] = []
    for j in items:
        if not isinstance(j, dict): continue
        post_id = j.get("id") or ""
        if not post_id: continue
        job_id = f"lever_{slug}_{post_id}"

        title = (j.get("text") or "").strip()
        if not title:
            continue

        cats = j.get("categories") or {}
        loc_str = (cats.get("location") or "").strip() or None
        team    = cats.get("team")
        commit  = cats.get("commitment")  # Full-time / Part-time / Intern

        description = (j.get("descriptionPlain") or j.get("description") or "").strip()
        # lever sometimes puts HTML in description; the descriptionPlain field is best
        description = description.replace("<br>", "\n").replace("</p>", "\n").strip()

        work_mode, is_remote = detect_work_mode(title, description, loc_str or "")
        job_type = commit or detect_job_type(title, description)
        if job_type:
            # normalize
            job_type = {"Intern": "Internship", "Fulltime": "Full-time", "Parttime": "Part-time"}.get(job_type, job_type)
        experience = detect_experience_level(title, description)
        is_intern = detect_internship(title, description) or (commit == "Intern")
        is_new_grad = detect_new_grad(title, description)

        sal_text = j.get("salaryRange")
        if isinstance(sal_text, dict):
            sal_min = sal_text.get("min")
            sal_max = sal_text.get("max")
            sal_period = sal_text.get("interval") or "year"
        else:
            sal_min, sal_max, sal_period = parse_salary(description[:600])

        apply_url = j.get("hostedUrl") or j.get("applyUrl") or ""

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
            "salary_currency":  "USD" if (sal_min or sal_max) else None,
            "salary_period":    sal_period,
            "description":      truncate(description, 3000),
            "url":              apply_url or None,
            "source_name":      "Lever",
            "tech_stack":       tech_stack or None,
            "posted_at":        None,  # Lever doesn't expose post date in this endpoint
            "fetched_at":       now_utc_iso(),
            "hash_dedupe":      compute_dedupe_hash(title, company_name, loc_str or ""),
            "is_active":        True,
        })

    return rows

"""Tests for main.fetch_jobicy_jobs with a mocked httpx client."""

import asyncio

import main


def test_fetch_jobicy_normalizes_a_job(patch_httpx):
    patch_httpx({"jobs": [{
        "id": 1,
        "jobTitle": "Senior Backend Engineer",
        "companyName": "Acme",
        "jobGeo": "USA",
        "url": "https://jobicy.com/j/1",
        "jobType": "full-time",
        "jobLevel": "Senior",
        "jobIndustry": ["Technology"],
        "pubDate": "2026-06-01",
        "jobExcerpt": "Build APIs.",
    }]})

    rows = asyncio.run(main.fetch_jobicy_jobs(limit=10))

    assert len(rows) == 1
    row = rows[0]
    assert row["job_id"] == "jobicy_1"
    assert row["company"] == "Acme"
    assert row["employment_type"] == "FULLTIME"
    assert row["industry"] == "Technology"
    assert row["is_remote"] is True
    assert row["source"] == "Jobicy"


def test_fetch_jobicy_returns_empty_on_http_error(patch_httpx):
    patch_httpx({}, status=500)
    assert asyncio.run(main.fetch_jobicy_jobs()) == []

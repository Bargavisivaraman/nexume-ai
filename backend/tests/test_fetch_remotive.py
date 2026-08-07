"""Tests for main.fetch_remotive_jobs with a mocked httpx client."""

import asyncio

import main


def test_fetch_remotive_normalizes_a_job(patch_httpx):
    patch_httpx({"jobs": [{
        "id": 9,
        "title": "Data Engineer",
        "company_name": "Beta",
        "candidate_required_location": "USA Only",
        "url": "https://remotive.com/j/9",
        "description": "<p>Pipelines.</p>",
        "job_type": "full_time",
        "category": "Data",
        "publication_date": "2026-05-01",
    }]})

    rows = asyncio.run(main.fetch_remotive_jobs(limit=5))

    assert len(rows) == 1
    row = rows[0]
    assert row["job_id"] == "rem_9"
    assert row["company"] == "Beta"
    assert row["location"] == "USA Only"
    assert row["is_remote"] is True
    assert row["country"] == "REMOTE"
    assert row["industry"] == "Data"


def test_fetch_remotive_returns_empty_on_http_error(patch_httpx):
    patch_httpx({}, status=503)
    assert asyncio.run(main.fetch_remotive_jobs()) == []

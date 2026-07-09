"""Tests for main.fetch_adzuna_jobs with a mocked httpx client."""

import asyncio

import main


def test_fetch_adzuna_normalizes_a_job(monkeypatch, patch_httpx):
    monkeypatch.setenv("ADZUNA_APP_ID", "id")
    monkeypatch.setenv("ADZUNA_APP_KEY", "key")
    patch_httpx({"results": [{
        "id": 7,
        "title": "Backend Engineer",
        "company": {"display_name": "Epsilon"},
        "location": {"area": ["US", "California", "Los Angeles"], "display_name": "Los Angeles, CA"},
        "category": {"label": "IT Jobs"},
        "description": "Build services.",
        "redirect_url": "https://adzuna.com/j/7",
        "created": "2026-03-01",
        "salary_min": 120000,
        "salary_max": 160000,
    }]})

    rows = asyncio.run(main.fetch_adzuna_jobs(keyword="engineer"))

    assert len(rows) == 1
    row = rows[0]
    assert row["job_id"] == "adzuna_7"
    assert row["company"] == "Epsilon"
    assert row["state"] == "CA"
    assert row["salary_min"] == 120000
    assert row["salary_max"] == 160000
    assert row["source"] == "Adzuna"


def test_fetch_adzuna_returns_empty_without_credentials(monkeypatch):
    monkeypatch.delenv("ADZUNA_APP_ID", raising=False)
    monkeypatch.delenv("ADZUNA_APP_KEY", raising=False)
    assert asyncio.run(main.fetch_adzuna_jobs()) == []

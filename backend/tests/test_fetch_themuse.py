"""Tests for main.fetch_themuse_jobs with a mocked httpx client."""

import asyncio

import main


def test_fetch_themuse_normalizes_a_job(patch_httpx):
    page1 = {"results": [{
        "id": 5,
        "name": "ML Engineer",
        "company": {"name": "Delta"},
        "locations": [{"name": "Los Angeles, CA"}],
        "levels": [{"name": "Senior Level"}],
        "categories": [{"name": "Data Science"}],
        "refs": {"landing_page": "https://themuse.com/j/5"},
        "publication_date": "2026-04-01",
        "contents": "Train models.",
    }]}
    page2 = {"results": []}  # stops the pagination loop
    patch_httpx(page1, page2)

    rows = asyncio.run(main.fetch_themuse_jobs(limit=10))

    assert len(rows) == 1
    row = rows[0]
    assert row["job_id"] == "muse_5"
    assert row["company"] == "Delta"
    assert row["location"] == "Los Angeles, CA"
    assert row["experience_level"] == "Senior Level"
    assert row["industry"] == "Data Science"
    assert row["source"] == "The Muse"


def test_fetch_themuse_filters_by_keyword(patch_httpx):
    page1 = {"results": [
        {"id": 1, "name": "ML Engineer", "categories": [{"name": "Data Science"}]},
        {"id": 2, "name": "Barista", "categories": [{"name": "Food"}]},
    ]}
    patch_httpx(page1, {"results": []})

    rows = asyncio.run(main.fetch_themuse_jobs(keyword="engineer", limit=10))

    assert [r["job_id"] for r in rows] == ["muse_1"]

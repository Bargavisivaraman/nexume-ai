"""Tests for main.fetch_arbeitnow_jobs with a mocked httpx client."""

import asyncio

import main


def test_fetch_arbeitnow_normalizes_a_job(patch_httpx):
    page1 = {"data": [{
        "slug": "abc",
        "title": "Frontend Engineer",
        "company_name": "Gamma",
        "location": "Remote",
        "url": "https://arbeitnow.com/j/abc",
        "tags": ["react"],
        "created_at": 1234567890,
        "description": "Build UIs.",
        "remote": True,
    }]}
    page2 = {"data": []}  # stops the pagination loop
    patch_httpx(page1, page2)

    rows = asyncio.run(main.fetch_arbeitnow_jobs(limit=10))

    assert len(rows) == 1
    row = rows[0]
    assert row["job_id"] == "arb_abc"
    assert row["company"] == "Gamma"
    assert row["industry"] == "React"
    assert row["is_remote"] is True
    assert row["posted_at"] == "1234567890"
    assert row["source"] == "Arbeitnow"


def test_fetch_arbeitnow_filters_by_keyword(patch_httpx):
    page1 = {"data": [
        {"slug": "a", "title": "Frontend Engineer", "tags": ["react"], "url": "u"},
        {"slug": "b", "title": "Warehouse Associate", "tags": ["logistics"], "url": "u"},
    ]}
    patch_httpx(page1, {"data": []})

    rows = asyncio.run(main.fetch_arbeitnow_jobs(keyword="frontend", limit=10))

    assert [r["job_id"] for r in rows] == ["arb_a"]

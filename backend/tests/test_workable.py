"""Tests for the Workable adapter using a mocked HTTP transport."""

import asyncio

import httpx

from aggregators.workable import _strip_html, fetch_workable


def _mock_client(response: httpx.Response) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(lambda request: response))


def _run(coro):
    return asyncio.run(coro)


def test_strip_html_handles_entities():
    assert _strip_html("<div>Ops &amp; Support</div>") == "Ops & Support"


def test_fetch_workable_normalizes_remote_job():
    sample = {"results": [{
        "shortcode": "XYZ789",
        "title": "Full Stack Engineer",
        "location": {"city": "Austin", "region": "TX", "country": "United States", "workplace": "remote"},
        "description": "<p>Work with Django and PostgreSQL.</p>",
        "requirements": "<p>3+ years experience.</p>",
        "employment_type": "full-time",
        "application_url": "https://apply.workable.com/acme/j/XYZ789",
        "published_on": "2026-06-15",
    }]}

    rows = _run(fetch_workable(_mock_client(httpx.Response(200, json=sample)), "acme", "Acme Inc"))

    assert len(rows) == 1
    row = rows[0]
    assert row["job_id"] == "workable_acme_XYZ789"
    assert row["title"] == "Full Stack Engineer"
    assert row["city"] == "Austin"
    assert row["state"] == "TX"
    assert row["work_mode"] == "Remote"
    assert row["is_remote"] is True
    assert row["job_type"] == "Full-time"
    assert row["source_name"] == "Workable"
    assert "Django" in (row["tech_stack"] or [])
    assert "PostgreSQL" in (row["tech_stack"] or [])


def test_fetch_workable_returns_empty_on_http_error():
    rows = _run(fetch_workable(_mock_client(httpx.Response(503)), "acme", "Acme"))
    assert rows == []

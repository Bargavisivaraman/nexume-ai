"""Tests for the Greenhouse adapter using a mocked HTTP transport."""

import asyncio

import httpx

from aggregators.greenhouse import _strip_html, fetch_greenhouse


def _mock_client(response: httpx.Response) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(lambda request: response))


def _run(coro):
    return asyncio.run(coro)


def test_strip_html_removes_tags_and_unescapes():
    assert _strip_html("<p>Hello &amp; welcome</p>") == "Hello & welcome"
    assert _strip_html(None) == ""


def test_fetch_greenhouse_normalizes_a_job():
    sample = {"jobs": [{
        "id": 123,
        "title": "Senior Backend Engineer",
        "location": {"name": "New York, NY"},
        "content": "<p>We use Python and AWS. This role is remote friendly.</p>",
        "absolute_url": "https://boards.greenhouse.io/acme/jobs/123",
        "updated_at": "2026-06-01T00:00:00Z",
        "metadata": [{"name": "Salary Range", "value": "$120k - $160k"}],
    }]}

    rows = _run(fetch_greenhouse(_mock_client(httpx.Response(200, json=sample)), "acme", "Acme Inc"))

    assert len(rows) == 1
    row = rows[0]
    assert row["job_id"] == "gh_acme_123"
    assert row["title"] == "Senior Backend Engineer"
    assert row["company"] == "Acme Inc"
    assert row["city"] == "New York"
    assert row["state"] == "NY"
    assert row["experience_level"] == "Senior"
    assert row["is_remote"] is True
    assert row["salary_min"] == 120000.0
    assert row["salary_max"] == 160000.0
    assert row["source_name"] == "Greenhouse"
    assert "Python" in (row["tech_stack"] or [])


def test_fetch_greenhouse_skips_untitled_jobs():
    sample = {"jobs": [{"id": 1, "title": "", "content": "x"}]}
    rows = _run(fetch_greenhouse(_mock_client(httpx.Response(200, json=sample)), "acme", "Acme"))
    assert rows == []


def test_fetch_greenhouse_returns_empty_on_http_error():
    rows = _run(fetch_greenhouse(_mock_client(httpx.Response(500)), "acme", "Acme"))
    assert rows == []

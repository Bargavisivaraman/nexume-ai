"""Tests for the Workable adapter using a mocked HTTP transport.

The real v3 endpoint is POST-only (GET returns 404) and its list response
carries countryCode / published / type / workplace — no description.
"""

import asyncio
import json

import httpx

from aggregators.workable import _strip_html, fetch_workable


def _mock_client(response: httpx.Response, seen_requests: list | None = None) -> httpx.AsyncClient:
    def handler(request):
        if seen_requests is not None:
            seen_requests.append(request)
        return response

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _run(coro):
    return asyncio.run(coro)


SAMPLE = {"total": 1, "results": [{
    "shortcode": "XYZ789",
    "title": "Full Stack Engineer",
    "remote": False,
    "location": {"city": "Austin", "region": "TX", "country": "United States", "countryCode": "US"},
    "published": "2026-06-15T00:00:00.000Z",
    "type": "full",
    "workplace": "hybrid",
}]}


def test_strip_html_handles_entities():
    assert _strip_html("<div>Ops &amp; Support</div>") == "Ops & Support"


def test_fetch_workable_posts_the_v3_filter_body():
    seen: list = []
    _run(fetch_workable(_mock_client(httpx.Response(200, json=SAMPLE), seen), "acme", "Acme Inc"))

    assert len(seen) == 1
    req = seen[0]
    assert req.method == "POST"  # a GET 404s on this endpoint
    assert str(req.url).endswith("/api/v3/accounts/acme/jobs")
    body = json.loads(req.read())
    assert body == {"query": "", "location": [], "department": [], "worktype": [], "remote": []}


def test_fetch_workable_normalizes_a_job():
    rows = _run(fetch_workable(_mock_client(httpx.Response(200, json=SAMPLE)), "acme", "Acme Inc"))

    assert len(rows) == 1
    row = rows[0]
    assert row["job_id"] == "workable_acme_XYZ789"
    assert row["title"] == "Full Stack Engineer"
    assert row["city"] == "Austin"
    assert row["state"] == "TX"
    assert row["country"] == "US"           # from countryCode, never "United States"[:2]
    assert row["work_mode"] == "Hybrid"
    assert row["is_remote"] is False
    assert row["job_type"] == "Full-time"   # "full" mapped
    assert row["posted_at"] == "2026-06-15T00:00:00.000Z"
    assert row["url"] == "https://apply.workable.com/acme/j/XYZ789/"
    assert row["source_name"] == "Workable"
    # The list response carries no description — stored as null, not invented
    assert row["description"] is None
    assert row["salary_min"] is None and row["salary_max"] is None


def test_fetch_workable_remote_flag_and_default_country():
    sample = {"total": 1, "results": [{
        "shortcode": "R1",
        "title": "Support Specialist",
        "remote": True,
        "location": {"city": None, "region": None, "country": "Brazil", "countryCode": "BR"},
        "published": "2026-10-30T00:00:00.000Z",
        "type": "part",
        "workplace": "remote",
    }]}
    rows = _run(fetch_workable(_mock_client(httpx.Response(200, json=sample)), "acme", "Acme"))

    row = rows[0]
    assert row["is_remote"] is True
    assert row["work_mode"] == "Remote"
    assert row["country"] == "BR"
    assert row["job_type"] == "Part-time"


def test_fetch_workable_falls_back_to_default_country_without_code():
    sample = {"total": 1, "results": [{
        "shortcode": "N1",
        "title": "Analyst",
        "location": {"city": "Columbus", "region": "OH", "country": "United States"},
        "type": "full",
        "workplace": "on_site",
    }]}
    rows = _run(fetch_workable(_mock_client(httpx.Response(200, json=sample)), "acme", "Acme"))
    assert rows[0]["country"] == "US"       # adapter default, not a mangled name
    assert rows[0]["work_mode"] == "On-site"


def test_fetch_workable_returns_empty_on_http_error():
    rows = _run(fetch_workable(_mock_client(httpx.Response(503)), "acme", "Acme"))
    assert rows == []

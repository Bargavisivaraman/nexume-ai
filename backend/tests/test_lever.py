"""Tests for the Lever adapter using a mocked HTTP transport."""

import asyncio

import httpx

from aggregators.lever import fetch_lever


def _mock_client(response: httpx.Response) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(lambda request: response))


def _run(coro):
    return asyncio.run(coro)


def test_fetch_lever_normalizes_intern_posting():
    sample = [{
        "id": "abc123",
        "text": "Software Engineer Intern",
        "categories": {"location": "San Francisco, CA", "commitment": "Intern", "team": "Eng"},
        "descriptionPlain": "Build things with TypeScript and React.",
        "hostedUrl": "https://jobs.lever.co/acme/abc123",
        "salaryRange": {"min": 30, "max": 40, "interval": "hour"},
    }]

    rows = _run(fetch_lever(_mock_client(httpx.Response(200, json=sample)), "acme", "Acme Inc"))

    assert len(rows) == 1
    row = rows[0]
    assert row["job_id"] == "lever_acme_abc123"
    assert row["job_type"] == "Internship"          # "Intern" commitment normalized
    assert row["is_internship"] is True
    assert row["experience_level"] == "Entry Level"
    assert row["city"] == "San Francisco"
    assert row["state"] == "CA"
    assert row["salary_min"] == 30                   # taken from the structured salaryRange
    assert row["salary_period"] == "hour"
    assert row["source_name"] == "Lever"
    assert "TypeScript" in (row["tech_stack"] or [])


def test_fetch_lever_skips_entries_without_id():
    sample = [{"text": "No id here"}]
    rows = _run(fetch_lever(_mock_client(httpx.Response(200, json=sample)), "acme", "Acme"))
    assert rows == []


def test_fetch_lever_returns_empty_on_http_error():
    rows = _run(fetch_lever(_mock_client(httpx.Response(404)), "acme", "Acme"))
    assert rows == []

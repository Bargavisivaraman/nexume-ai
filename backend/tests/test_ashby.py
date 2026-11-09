"""Tests for the Ashby adapter using a mocked HTTP transport."""

import asyncio

import httpx

from aggregators.ashby import _strip_html, fetch_ashby


def _mock_client(response: httpx.Response) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(lambda request: response))


def _run(coro):
    return asyncio.run(coro)


def test_strip_html_removes_tags():
    assert _strip_html("<p>Hello &amp; hi</p>") == "Hello & hi"


def test_fetch_ashby_normalizes_remote_job_with_compensation():
    # Real shape: compensationTierSummary is a display STRING; the structured
    # numbers live in compensationTiers[0].components.
    sample = {"jobs": [{
        "id": "job_1",
        "title": "Staff ML Engineer",
        "location": "Remote - US",
        "descriptionHtml": "<p>Work with PyTorch and Kubernetes.</p>",
        "isRemote": True,
        "employmentType": "FullTime",
        "compensation": {
            "compensationTierSummary": "$180K – $240K • Offers Equity",
            "compensationTiers": [{
                "components": [
                    {"compensationType": "EquityPercentage", "minValue": None,
                     "maxValue": None, "currencyCode": None, "interval": "NONE"},
                    {"compensationType": "Salary", "minValue": 180000,
                     "maxValue": 240000, "currencyCode": "USD", "interval": "1 YEAR"},
                ],
            }],
        },
        "jobUrl": "https://jobs.ashbyhq.com/acme/job_1",
    }]}

    rows = _run(fetch_ashby(_mock_client(httpx.Response(200, json=sample)), "acme", "Acme Inc"))

    assert len(rows) == 1
    row = rows[0]
    assert row["job_id"] == "ashby_acme_job_1"
    assert row["title"] == "Staff ML Engineer"
    assert row["is_remote"] is True
    assert row["work_mode"] == "Remote"
    assert row["experience_level"] == "Senior"
    assert row["job_type"] == "Full-time"       # structured employmentType wins
    assert row["salary_min"] == 180000          # Salary component, not the equity one
    assert row["salary_max"] == 240000
    assert row["salary_currency"] == "USD"
    assert row["salary_period"] == "year"
    assert row["source_name"] == "Ashby"
    assert "PyTorch" in (row["tech_stack"] or [])
    assert "Kubernetes" in (row["tech_stack"] or [])


def test_fetch_ashby_parses_salary_from_summary_string_fallback():
    sample = {"jobs": [{
        "id": "job_2",
        "title": "Backend Engineer",
        "location": "New York",
        "compensation": {"compensationTierSummary": "$207K – $285K • Offers Equity"},
    }]}

    rows = _run(fetch_ashby(_mock_client(httpx.Response(200, json=sample)), "acme", "Acme"))

    row = rows[0]
    assert row["salary_min"] == 207000.0
    assert row["salary_max"] == 285000.0
    assert row["salary_period"] == "year"


def test_fetch_ashby_uses_structured_employment_type_for_interns():
    sample = {"jobs": [{
        "id": "job_3",
        "title": "Engineering Co-op",
        "location": "Boston",
        "employmentType": "Intern",
    }]}

    rows = _run(fetch_ashby(_mock_client(httpx.Response(200, json=sample)), "acme", "Acme"))
    assert rows[0]["job_type"] == "Internship"


def test_fetch_ashby_skips_items_without_id():
    sample = {"jobs": [{"title": "No id"}]}
    rows = _run(fetch_ashby(_mock_client(httpx.Response(200, json=sample)), "acme", "Acme"))
    assert rows == []


def test_fetch_ashby_returns_empty_on_http_error():
    rows = _run(fetch_ashby(_mock_client(httpx.Response(500)), "acme", "Acme"))
    assert rows == []

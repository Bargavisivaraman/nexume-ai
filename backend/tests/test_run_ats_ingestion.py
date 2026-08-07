"""Tests for aggregators.pipeline.run_ats_ingestion with faked fetchers + DB."""

import asyncio

import aggregators.pipeline as pipeline
from tests.conftest import FakeSupabase

COMPANIES = [
    {"name": "Acme", "ats": "greenhouse", "slug": "acme", "industry": "Technology", "tier": "tier1"},
    {"name": "Beta", "ats": "lever", "slug": "beta", "industry": "Technology", "tier": "tier1"},
]


def _row(job_id, title="Software Engineer"):
    return {"job_id": job_id, "title": title, "industry": None}


def _patch(monkeypatch, per_company_rows):
    async def fake_greenhouse(http, slug, name, **kw):
        return per_company_rows.get("acme", [])

    async def fake_lever(http, slug, name, **kw):
        return per_company_rows.get("beta", [])

    monkeypatch.setitem(pipeline.FETCHERS, "greenhouse", fake_greenhouse)
    monkeypatch.setitem(pipeline.FETCHERS, "lever", fake_lever)
    monkeypatch.setattr(pipeline, "list_companies_by_tier", lambda tier: COMPANIES)


def test_fetches_dedupes_and_upserts(monkeypatch):
    _patch(monkeypatch, {
        "acme": [_row("a1"), _row("shared")],
        "beta": [_row("b1"), _row("shared")],  # duplicate across companies
    })
    fake_db = FakeSupabase()

    stats = asyncio.run(pipeline.run_ats_ingestion(fake_db, tier="tier1"))

    assert stats["companies_run"] == 2
    assert stats["fetched"] == 4
    assert stats["inserted"] == 3  # 'shared' deduped

    upserted = fake_db.payloads("jobs", "upsert")[0]
    assert sorted(r["job_id"] for r in upserted) == ["a1", "b1", "shared"]
    # Industry hint applied where the adapter left it null
    assert all(r["industry"] for r in upserted)

    logged = fake_db.payloads("ingestion_runs", "insert")
    assert logged and logged[0]["fetched"] == 4


def test_db_failure_counts_chunk_as_errors(monkeypatch):
    _patch(monkeypatch, {"acme": [_row("a1")], "beta": []})

    class _FailingJobsDB(FakeSupabase):
        def table(self, name):
            if name == "jobs":
                raise RuntimeError("db down")
            return super().table(name)

    stats = asyncio.run(pipeline.run_ats_ingestion(_FailingJobsDB(), tier="tier1"))

    assert stats["inserted"] == 0
    assert stats["errors"] == 1


def test_no_companies_short_circuits(monkeypatch):
    monkeypatch.setattr(pipeline, "list_companies_by_tier", lambda tier: [])
    fake_db = FakeSupabase()

    stats = asyncio.run(pipeline.run_ats_ingestion(fake_db, tier="tier9"))

    assert stats == {"fetched": 0, "inserted": 0, "errors": 0, "companies_run": 0}
    assert fake_db.calls == []

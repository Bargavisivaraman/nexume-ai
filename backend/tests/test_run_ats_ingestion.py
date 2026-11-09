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


def test_preserves_fetched_at_for_rows_already_in_the_db(monkeypatch):
    """A 5-min tier1 re-upsert must not bump fetched_at across the whole
    corpus — only genuinely new rows keep their fresh timestamp."""
    OLD = "2026-01-01T00:00:00+00:00"
    FRESH = "2026-11-08T12:00:00+00:00"
    _patch(monkeypatch, {
        "acme": [
            {"job_id": "a1", "title": "Software Engineer", "industry": None, "fetched_at": FRESH},
            {"job_id": "b1", "title": "Software Engineer", "industry": None, "fetched_at": FRESH},
        ],
        "beta": [],
    })
    # The DB already holds a1 — the lookup returns its original fetched_at
    fake_db = FakeSupabase(tables={"jobs": [{"job_id": "a1", "fetched_at": OLD}]})

    asyncio.run(pipeline.run_ats_ingestion(fake_db, tier="tier1"))

    upserted = {r["job_id"]: r for r in fake_db.payloads("jobs", "upsert")[0]}
    assert upserted["a1"]["fetched_at"] == OLD     # existing row keeps its timestamp
    assert upserted["b1"]["fetched_at"] == FRESH   # new row is stamped now


def test_company_industry_fills_in_when_title_is_unclassifiable(monkeypatch):
    _patch(monkeypatch, {
        "acme": [
            {"job_id": "a1", "title": "Pastry Chef", "industry": None},
            {"job_id": "a2", "title": "Registered Nurse", "industry": None},
        ],
        "beta": [],
    })
    fake_db = FakeSupabase()

    asyncio.run(pipeline.run_ats_ingestion(fake_db, tier="tier1"))

    upserted = {r["job_id"]: r for r in fake_db.payloads("jobs", "upsert")[0]}
    # Title classifier punts ("Other") → the company's registry industry wins
    assert upserted["a1"]["industry"] == "Technology"
    # A classifiable title still beats the company hint
    assert upserted["a2"]["industry"] == "Healthcare"


def test_no_companies_short_circuits(monkeypatch):
    monkeypatch.setattr(pipeline, "list_companies_by_tier", lambda tier: [])
    fake_db = FakeSupabase()

    stats = asyncio.run(pipeline.run_ats_ingestion(fake_db, tier="tier9"))

    assert stats == {"fetched": 0, "inserted": 0, "errors": 0, "companies_run": 0}
    assert fake_db.calls == []

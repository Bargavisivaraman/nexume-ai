"""Tests for jobs.run_ingestion with faked JSearch and Supabase."""

import asyncio

import jobs
from tests.conftest import FakeSupabase

RAW_OK = {
    "job_id": "abc",
    "job_title": "Backend Engineer",
    "employer_name": "Acme",
    "job_city": "Austin",
    "job_state": "TX",
    "job_description": "Build APIs.",
    "job_apply_link": "https://www.linkedin.com/jobs/view/abc",
    "job_employment_type": "FULLTIME",
    "job_is_remote": False,
}
RAW_INVALID = {"job_id": "", "job_title": "", "employer_name": ""}  # transform -> None


def _patch_sources(monkeypatch, raw_jobs):
    async def fake_fetch(http, key, query, num_pages=3):
        return raw_jobs

    async def no_sleep(_secs):
        return None

    monkeypatch.setattr(jobs, "fetch_jsearch", fake_fetch)
    monkeypatch.setattr(jobs.asyncio, "sleep", no_sleep)


def test_transforms_and_upserts_valid_rows(monkeypatch):
    _patch_sources(monkeypatch, [RAW_OK, RAW_INVALID])
    fake_db = FakeSupabase()

    stats = asyncio.run(jobs.run_ingestion(fake_db, "key", ["python"], "US"))

    assert stats["fetched"] == 2
    assert stats["inserted"] == 1
    assert stats["skipped"] == 1

    upserts = fake_db.payloads("jobs", "upsert")
    assert len(upserts) == 1
    assert upserts[0][0]["job_id"] == "abc"
    assert upserts[0][0]["company"] == "Acme"

    # The run is logged to ingestion_runs
    logged = fake_db.payloads("ingestion_runs", "insert")
    assert logged and logged[0]["country"] == "US"
    assert logged[0]["inserted"] == 1


def test_counts_an_empty_fetch_as_an_error(monkeypatch):
    _patch_sources(monkeypatch, [])
    fake_db = FakeSupabase()

    stats = asyncio.run(jobs.run_ingestion(fake_db, "key", ["python", "java"], "US"))

    assert stats["errors"] == 2
    assert stats["inserted"] == 0
    assert fake_db.payloads("jobs", "upsert") == []


def test_upsert_failure_counts_rows_as_errors_and_skipped(monkeypatch):
    _patch_sources(monkeypatch, [RAW_OK])

    class _FailingUpsertDB(FakeSupabase):
        def table(self, name):
            if name == "jobs":
                raise RuntimeError("db down")
            return super().table(name)

    fake_db = _FailingUpsertDB()
    stats = asyncio.run(jobs.run_ingestion(fake_db, "key", ["python"], "US"))

    assert stats["inserted"] == 0
    assert stats["errors"] == 1
    assert stats["skipped"] == 1

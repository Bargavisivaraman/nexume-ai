"""Tests for the scheduled refresh_all_jobs wrapper."""

import asyncio

import main


def test_skips_entirely_without_a_jsearch_key(monkeypatch):
    calls = []

    async def fake_run(*args, **kwargs):
        calls.append(args)
        return {}

    monkeypatch.setattr(main, "JSEARCH_API_KEY", "")
    monkeypatch.setattr(main, "run_ingestion", fake_run)

    asyncio.run(main.refresh_all_jobs())
    assert calls == []


def test_runs_ingestion_for_both_countries(monkeypatch):
    calls = []

    async def fake_run(supabase, key, queries, country):
        calls.append((key, country))
        return {"inserted": 1}

    monkeypatch.setattr(main, "JSEARCH_API_KEY", "jkey")
    monkeypatch.setattr(main, "run_ingestion", fake_run)

    asyncio.run(main.refresh_all_jobs())
    assert calls == [("jkey", "IN"), ("jkey", "US")]


def test_swallows_ingestion_failures(monkeypatch):
    async def boom(*args, **kwargs):
        raise RuntimeError("upstream down")

    monkeypatch.setattr(main, "JSEARCH_API_KEY", "jkey")
    monkeypatch.setattr(main, "run_ingestion", boom)

    asyncio.run(main.refresh_all_jobs())  # must not raise — scheduler safety

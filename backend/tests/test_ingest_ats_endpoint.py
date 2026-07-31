"""Tests for POST /jobs/ingest-ats — the admin-gated ATS ingestion trigger.

The background task is made a no-op by patching the company list to empty,
so no fetcher or DB work runs.
"""

import aggregators.pipeline as pipeline


def _noop_companies(monkeypatch):
    monkeypatch.setattr(pipeline, "list_companies_by_tier", lambda tier: [])
    monkeypatch.setattr(pipeline, "COMPANIES", [])


def test_requires_the_admin_token(api_client, monkeypatch):
    monkeypatch.delenv("NEXUME_ADMIN_TOKEN", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)

    resp = api_client.post("/jobs/ingest-ats")
    assert resp.status_code == 404  # no route disclosure


def test_triggers_and_echoes_the_tier(api_client, fake_supabase, monkeypatch):
    _noop_companies(monkeypatch)
    fake_supabase()
    monkeypatch.setenv("NEXUME_ADMIN_TOKEN", "tok")

    resp = api_client.post("/jobs/ingest-ats", params={"tier": "tier2"},
                           headers={"x-admin-token": "tok"})

    assert resp.status_code == 200
    assert "tier=tier2" in resp.json()["message"]


def test_omitted_tier_reads_as_all(api_client, fake_supabase, monkeypatch):
    _noop_companies(monkeypatch)
    fake_supabase()
    monkeypatch.setenv("NEXUME_ADMIN_TOKEN", "tok")

    resp = api_client.post("/jobs/ingest-ats", headers={"x-admin-token": "tok"})

    assert resp.status_code == 200
    assert "tier=all" in resp.json()["message"]
